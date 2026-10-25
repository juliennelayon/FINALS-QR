process.on(
  "uncaughtException",
  (e: Error & { where?: string; position?: string }) => {
    console.error(
      "Database test failed:",
      e.message,
      e.where || "",
      e.position || "",
    );
    process.exit(1);
  },
);
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import assert from "node:assert/strict";
async function main(): Promise<void> {
  const db = new PGlite();
  let passed = 0;
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.role() returns text language sql stable as $$select current_user::text$$;grant usage on schema auth,public,storage to authenticated,anon,service_role;grant execute on function auth.uid(),auth.role() to public;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;create publication supabase_realtime;`,
  );
  await db.exec(fs.readFileSync("Supabase/schema.sql", "utf8"));
  await db.exec(fs.readFileSync("Supabase/scanin_migration.sql", "utf8"));
  await db.exec(fs.readFileSync("Supabase/scanin_migration.sql", "utf8"));
  console.log("PASS migration reruns safely");
  passed++;
  const id = (n: number) =>
    `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  for (let n = 1; n <= 9; n++)
    await db.query(
      `insert into auth.users(id,email,raw_user_meta_data)values($1,$2,$3)`,
      [
        id(n),
        `u${n}@school.test`,
        JSON.stringify({
          full_name: `User ${n}`,
          role: n <= 3 ? "teacher" : "student",
        }),
      ],
    );
  await db.exec(
    `update profiles set role='administrator',status='approved' where id='${id(1)}';update profiles set status='approved' where id in ('${id(2)}','${id(3)}');`,
  );
  for (let n = 4; n <= 9; n++)
    await db.query(
      `insert into student_profiles(user_id,student_id_no,course,course_year,block,gender,email,phone)values($1,$2,$3,$4,$5,'FEMALE',$6,'09123456789')`,
      [
        id(n),
        `S${n}`,
        n === 5 ? "BSHM" : "BSIT",
        n === 6 ? "SECOND YEAR" : "FIRST YEAR",
        n === 7 ? "B" : "A",
        `u${n}@school.test`,
      ],
    );
  async function as(n: number | null, sql: string, args: unknown[] = []) {
    await db.exec("reset role");
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [
      n ? id(n) : "",
    ]);
    await db.exec(n ? "set role authenticated" : "set role anon");
    try {
      return await db.query<Record<string, any>>(sql, args);
    } finally {
      await db.exec("reset role");
      await db.exec(`select set_config('request.jwt.claim.sub','',false)`);
    }
  }
  async function test(name: string, fn: () => void | Promise<void>) {
    await fn();
    passed++;
    console.log("PASS", name);
  }
  async function denied(
    n: number | null,
    sql: string,
    args: unknown[] = [],
    pattern?: RegExp,
  ) {
    let e: unknown;
    try {
      await as(n, sql, args);
    } catch (x) {
      e = x;
    }
    assert.ok(e instanceof Error, "Expected rejection");
    if (pattern) assert.match(e.message, pattern);
  }
  const changes = {
    title: "IT First Year A Meeting",
    venue: "IT Lab",
    description: "First year BSIT Block A meeting.",
    start_time: new Date(Date.now() - 5 * 60000).toISOString(),
    end_time: new Date(Date.now() + 60 * 60000).toISOString(),
    required: true,
    audience_course: "BSIT",
    audience_year: "FIRST YEAR",
    audience_block: "A",
    late_minutes: 15,
  };
  const eid = (
    await as(2, "select scanin_manage_event(null,$1::jsonb,'publish') as id", [
      JSON.stringify(changes),
    ])
  ).rows[0].id;
  const code = (await as(2, "select event_code from events where id=$1", [eid]))
    .rows[0].event_code;
  await test("published roster contains only matching course/year/block", async () => {
    const a = (
      await as(2, "select * from event_audience where event_id=$1", [eid])
    ).rows;
    assert.deepEqual(a.map((x) => x.student_id).sort(), [id(4), id(8), id(9)]);
  });
  await test("wrong course blocked", () =>
    denied(5, "select scanin_record($1,'qr')", [code], /not eligible/));
  await test("same course, wrong year blocked with manual code", () =>
    denied(6, "select scanin_record($1,'manual')", [code], /not eligible/));
  await test("wrong block blocked", () =>
    denied(7, "select scanin_record($1,'qr')", [code], /not eligible/));
  await test("eligible student records Present", async () => {
    const a = (await as(4, "select scanin_record($1,'qr') as result", [code]))
      .rows[0].result;
    assert.equal(a.status, "present");
    assert.equal(a.duplicate, false);
  });
  await test("QR followed by manual produces no duplicate", async () => {
    const a = (
      await as(4, "select scanin_record($1,'manual') as result", [code])
    ).rows[0].result;
    assert.equal(a.duplicate, true);
    assert.equal((await as(4, "select * from attendance")).rows.length, 1);
  });
  await test("manual followed by QR produces no duplicate", async () => {
    await as(8, "select scanin_record($1,'manual')", [code]);
    const a = (await as(8, "select scanin_record($1,'qr') as result", [code]))
      .rows[0].result;
    assert.equal(a.duplicate, true);
  });
  await test("student cannot spoof direct table insert", () =>
    denied(
      4,
      "insert into attendance(student_id,event_id,status)values($1,$2,'present')",
      [id(5), eid],
      /permission denied/,
    ));
  await test("student reads own attendance only", async () =>
    assert.ok(
      (await as(4, "select * from attendance")).rows.every(
        (x) => x.student_id === id(4),
      ),
    ));
  await test("organizer sees records, other teacher sees none", async () => {
    assert.equal((await as(2, "select * from attendance")).rows.length, 2);
    assert.equal((await as(3, "select * from attendance")).rows.length, 0);
    assert.equal((await as(3, "select * from events")).rows.length, 0);
  });
  await test("teacher cannot directly correct attendance", () =>
    denied(
      2,
      "update attendance set status='late' where event_id=$1",
      [eid],
      /permission denied/,
    ));
  await test("teacher cannot use admin correction RPC", () =>
    denied(
      2,
      "select scanin_correct($1,$2,'late','test')",
      [eid, id(4)],
      /Admin/,
    ));
  await test("student profile locks after completion", () =>
    denied(
      4,
      "update student_profiles set course='BSHM' where user_id=$1",
      [id(4)],
      /locked/,
    ));
  await test("student cannot change role", () =>
    denied(
      4,
      "update profiles set role='administrator' where id=$1",
      [id(4)],
      /permission denied/,
    ));
  await test("anon cannot call attendance RPC", () =>
    denied(null, "select scanin_record($1)", [code], /permission denied/));
  await test("unrelated teacher cannot edit event", () =>
    denied(
      3,
      "select scanin_manage_event($1,'{}','close')",
      [eid],
      /not found/,
    ));
  await test("teacher rule changes after check-in require review", () =>
    denied(
      2,
      "select scanin_manage_event($1,$2,'save')",
      [eid, JSON.stringify({ late_minutes: 3 })],
      /admin review/,
    ));
  await test("correction request reviewed exactly once", async () => {
    const rid = (
      await as(
        2,
        "select scanin_request('attendance',$1,$2,'{\"status\":\"late\"}','Verified late arrival') as id",
        [eid, id(4)],
      )
    ).rows[0].id;
    await as(1, "select scanin_resolve($1,true,'Verified with teacher')", [
      rid,
    ]);
    assert.equal(
      (await as(4, "select status from attendance where event_id=$1", [eid]))
        .rows[0].status,
      "late",
    );
    await denied(
      1,
      "select scanin_resolve($1,true,'again')",
      [rid],
      /no longer pending/,
    );
  });
  await test("admin correction preserves scan time and writes audit", async () => {
    const a = (
      await as(
        1,
        "select * from attendance where event_id=$1 and student_id=$2",
        [eid, id(4)],
      )
    ).rows[0];
    assert.ok(a.scanned_at);
    assert.ok(a.corrected_at);
    assert.ok(
      (await as(1, "select * from audit_log where action='correct'")).rows
        .length,
    );
  });
  await test("early close blocks new check-in; reopen resumes", async () => {
    await as(2, "select scanin_manage_event($1,'{}','close','Room closed')", [
      eid,
    ]);
    await denied(9, "select scanin_record($1)", [code], /not open/);
    await as(2, "select scanin_manage_event($1,'{}','reopen')", [eid]);
  });
  await test("Late computed using server time", async () => {
    await as(
      1,
      "select scanin_manage_event($1,$2,'admin_change','Verified start time')",
      [
        eid,
        JSON.stringify({
          start_time: new Date(Date.now() - 20 * 60000).toISOString(),
        }),
      ],
    );
    const result = (await as(9, "select scanin_record($1) as result", [code]))
      .rows[0].result;
    assert.equal(result.status, "late");
  });
  await test("suspended student blocked", async () => {
    await as(
      1,
      "select scanin_account($1,'suspend','Testing account restriction')",
      [id(9)],
    );
    await denied(9, "select scanin_record($1)", [code], /active students/);
    await as(1, "select scanin_account($1,'reactivate','Restored')", [id(9)]);
  });
  await test("admin cannot suspend self", () =>
    denied(
      1,
      "select scanin_account($1,'suspend','test')",
      [id(1)],
      /different account/,
    ));
  await test("approved profile request applies correction", async () => {
    const rid = (
      await as(
        4,
        "select scanin_request('profile',null,$1,'{\"phone\":\"09999999999\"}','Wrong contact number') as id",
        [id(4)],
      )
    ).rows[0].id;
    await as(1, "select scanin_resolve($1,true,'Confirmed correction')", [rid]);
    assert.equal(
      (
        await as(4, "select phone from student_profiles where user_id=$1", [
          id(4),
        ])
      ).rows[0].phone,
      "09999999999",
    );
  });
  await test("required end finalizes Absent without invented scan times", async () => {
    const ch = {
      ...changes,
      title: "Required second meeting",
      start_time: new Date(Date.now() + 3600000).toISOString(),
      end_time: new Date(Date.now() + 7200000).toISOString(),
    };
    const e2 = (
      await as(
        2,
        "select scanin_manage_event(null,$1::jsonb,'publish') as id",
        [JSON.stringify(ch)],
      )
    ).rows[0].id;
    await db.query(
      "update events set start_time=now()-interval '2 hours',end_time=now()-interval '1 hour' where id=$1",
      [e2],
    );
    await as(4, "select scanin_sync()");
    const records = (
      await as(1, "select * from attendance where event_id=$1", [e2])
    ).rows;
    assert.equal(records.length, 3);
    assert.ok(
      records.every((x) => x.status === "absent" && x.scanned_at === null),
    );
    assert.equal(
      (await as(5, "select * from attendance where event_id=$1", [e2])).rows
        .length,
      0,
    );
  });
  await test("cancelled event never creates auto absences", async () => {
    await as(
      2,
      "select scanin_manage_event($1,'{}','cancel','Event cancelled')",
      [eid],
    );
    await db.query(
      "update events set end_time=now()-interval '1 hour' where id=$1",
      [eid],
    );
    await db.exec("select scanin_tick()");
    assert.equal(
      (
        await as(
          1,
          "select count(*)::int n from attendance where event_id=$1 and status='absent'",
          [eid],
        )
      ).rows[0].n,
      0,
    );
  });

  await test("private maintenance helper cannot be called by a student", () =>
    denied(4, "select scanin_tick()", [], /permission denied/));
  await test("future events reject before start even with a valid code", async () => {
    const ch = {
      ...changes,
      title: "Upcoming meeting",
      start_time: new Date(Date.now() + 20 * 60000).toISOString(),
      end_time: new Date(Date.now() + 90 * 60000).toISOString(),
    };
    const e3 = (
      await as(
        2,
        "select scanin_manage_event(null,$1::jsonb,'publish') as id",
        [JSON.stringify(ch)],
      )
    ).rows[0].id;
    const c3 = (await as(2, "select event_code from events where id=$1", [e3]))
      .rows[0].event_code;
    await denied(4, "select scanin_record($1)", [c3], /not started/);
    await as(4, "select scanin_sync()");
    const before = (
      await as(
        4,
        "select count(*)::int n from notifications where event_id=$1 and dedupe_key like 'start:%'",
        [e3],
      )
    ).rows[0].n;
    await as(4, "select scanin_sync()");
    const after = (
      await as(
        4,
        "select count(*)::int n from notifications where event_id=$1 and dedupe_key like 'start:%'",
        [e3],
      )
    ).rows[0].n;
    assert.equal(before, 1);
    assert.equal(after, 1);
  });
  await test("new completed matching student joins unfinished events only", async () => {
    const uid = id(10);
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data)values($1,'u10@school.test',$2)",
      [uid, JSON.stringify({ role: "student", full_name: "New Student" })],
    );
    await as(
      10,
      "insert into student_profiles(user_id,student_id_no,course,course_year,block,gender,email,phone)values($1,'S10','BSIT','FIRST YEAR','A','FEMALE','u10@school.test','09123456789')",
      [uid],
    );
    const list = (await as(10, "select * from events")).rows;
    assert.ok(list.some((e) => e.title === "Upcoming meeting"));
    assert.ok(!list.some((e) => e.title === "Required second meeting"));
  });
  await test("reviewed profile correction reconciles unfinished audience", async () => {
    await as(
      1,
      "select scanin_admin_details($1,$2::jsonb,'Verified program correction')",
      [id(10), JSON.stringify({ course: "BSHM" })],
    );
    const list = (await as(10, "select * from events")).rows;
    assert.ok(!list.some((e) => e.title === "Upcoming meeting"));
  });
  await test("selected event rejects code belonging to another event", async () => {
    const e3 = (
      await as(
        2,
        "select id,event_code from events where title='Upcoming meeting'",
      )
    ).rows[0];
    await denied(
      4,
      "select scanin_record($1,'manual',$2)",
      [e3.event_code, eid],
      /different event/,
    );
  });
  await test("reviewed end extension resets only automatic absences", async () => {
    const e2 = (
      await as(1, "select id from events where title='Required second meeting'")
    ).rows[0].id;
    await as(1, "select scanin_correct($1,$2,'absent','Reviewed absence')", [
      e2,
      id(4),
    ]);
    await as(
      1,
      "select scanin_manage_event($1,$2,'admin_change','Approved extension')",
      [
        e2,
        JSON.stringify({
          end_time: new Date(Date.now() + 3600000).toISOString(),
        }),
      ],
    );
    const rows = (
      await as(1, "select * from attendance where event_id=$1", [e2])
    ).rows;
    assert.equal(rows.length, 1);
    assert.ok(rows[0].corrected_at);
  });

  await test("focused event-code update is repeatable", async () => {
    await db.exec(
      fs.readFileSync("Supabase/event_code_form_update.sql", "utf8"),
    );
    await db.exec(
      fs.readFileSync("Supabase/event_code_form_update.sql", "utf8"),
    );
  });
  await test("visible generated code is the code stored by the server", async () => {
    const input = {
      ...changes,
      title: "Visible code event",
      event_code: "SI-ABC1234567",
      start_time: new Date(Date.now() + 3600000).toISOString(),
      end_time: new Date(Date.now() + 7200000).toISOString(),
    };
    const result = await as(
      2,
      "select scanin_manage_event(null,$1::jsonb,'publish') as id",
      [JSON.stringify(input)],
    );
    const row = (
      await as(2, "select event_code from events where id=$1", [
        result.rows[0].id,
      ])
    ).rows[0];
    assert.equal(row.event_code, input.event_code);
  });
  await test("duplicate event codes are blocked", () =>
    denied(
      2,
      "select scanin_manage_event(null,$1::jsonb,'publish')",
      [JSON.stringify({ ...changes, event_code: "SI-ABC1234567" })],
      /duplicate key/,
    ));
  await test("saved event codes cannot be changed", async () => {
    const row = (
      await as(2, "select id from events where event_code='SI-ABC1234567'")
    ).rows[0];
    await denied(
      2,
      "select scanin_manage_event($1,$2::jsonb,'save')",
      [row.id, JSON.stringify({ event_code: "SI-ZZZ9999999" })],
      /cannot be changed/,
    );
  });
  await test("invalid visible code rejected by the server", () =>
    denied(
      2,
      "select scanin_manage_event(null,$1::jsonb,'publish')",
      [JSON.stringify({ ...changes, event_code: "invalid code" })],
      /format/,
    ));
  console.log(`\n${passed} database integration checks passed`);
  await db.close();
}
main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
