import { useEffect, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as XLSX from "xlsx-js-style";
import { useData } from "@/lib/AppData";
import {
  ScanEvent,
  monthKey,
  monthLabel,
  phDate,
  phase,
  rate,
} from "@/lib/domain";
import { buildCsv, csvFileName, exportCsv } from "@/lib/exportCsv";
import { excelFileName, exportExcel } from "@/lib/exportExcel";
import {
  Badge,
  Button,
  Chips,
  Empty,
  Field,
  Page,
  s,
  Sheet,
  Stat,
  Txt,
} from "@/components/Kit";
import { useNotice } from "@/components/Notice";
import { studentRows, Breakdown } from "@/components/AttendanceViews";
function StudentHistory() {
  const d = useData(),
    params = useLocalSearchParams(),
    [search, S] = useState(""),
    [filter, F] = useState(String(params.status || "All")),
    [month, M] = useState("All Months"),
    [selected, A] = useState<any>(null);
  useEffect(() => {
    if (params.status) F(String(params.status));
    if (params.event) {
      const a = d.attendance.find(
        (a: any) => a.event_id === params.event && a.student_id === d.me?.id,
      );
      if (a) A(a);
    }
  }, [params.event, params.status, d.attendance.length]);
  const all = d.attendance
    .filter((a: any) => a.student_id === d.me?.id)
    .map((a: any) => ({
      ...a,
      event: d.events.find((e: any) => e.id === a.event_id),
    }))
    .filter((a: any) => a.event)
    .sort(
      (a: any, b: any) =>
        Date.parse(b.event.start_time || b.event.created_at) -
        Date.parse(a.event.start_time || a.event.created_at),
    );
  const months = [
    ...new Set<string>(
      all.map((a: any) => monthKey(a.event.start_time || a.event.created_at)),
    ),
  ];
  const rows = all.filter(
    (a: any) =>
      (filter === "All" || a.status === filter.toLowerCase()) &&
      (month === "All Months" ||
        monthKey(a.event.start_time || a.event.created_at) === month) &&
      `${a.event.title} ${a.event.event_code}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const groups = [
    ...new Set<string>(
      rows.map((a: any) => monthKey(a.event.start_time || a.event.created_at)),
    ),
  ];
  return (
    <Page
      title="Attendance History"
      subtitle="Your attendance, one event at a time"
      onRefresh={d.reload}
      refreshing={d.loading}
    >
      <Field
        label="Search history"
        value={search}
        onChangeText={S}
        placeholder="Event name or code"
      />
      <Chips
        items={["All", "Present", "Late", "Absent"]}
        value={filter}
        onChange={F}
      />
      <Chips items={["All Months", ...months]} value={month} onChange={M} />
      {!rows.length && (
        <Empty
          title="No attendance records"
          body="Your recorded attendance and finalized required-event absences will appear here."
        />
      )}
      {groups.map((group) => (
        <View key={group} style={{ gap: 14 }}>
          <Text style={s.h}>
            {monthLabel(
              rows.find(
                (a: any) =>
                  monthKey(a.event.start_time || a.event.created_at) === group,
              ).event.start_time ||
                rows.find(
                  (a: any) =>
                    monthKey(a.event.start_time || a.event.created_at) ===
                    group,
                ).event.created_at,
            )}
          </Text>
          <View style={s.grid}>
            {rows
              .filter(
                (a: any) =>
                  monthKey(a.event.start_time || a.event.created_at) === group,
              )
              .map((a: any) => (
                <Pressable
                  key={a.id}
                  onPress={() => A(a)}
                  style={[s.card, { flexBasis: 290, flexGrow: 1, gap: 10 }]}
                >
                  <View
                    style={{
                      height: 70,
                      borderRadius: 12,
                      backgroundColor: "#D1FAE5",
                      justifyContent: "center",
                      padding: 14,
                    }}
                  >
                    <Text style={[s.h, { fontSize: 27 }]}>▣</Text>
                  </View>
                  <Badge value={a.status} />
                  <Text style={s.h}>{a.event.title}</Text>
                  <Txt muted>Event Code: {a.event.event_code}</Txt>
                  <Txt>Venue: {a.event.venue}</Txt>
                  <Text numberOfLines={3} style={s.muted}>
                    {a.event.description}
                  </Text>
                  <Txt muted>
                    Schedule: {phDate(a.event.start_time)} →{" "}
                    {phDate(a.event.end_time)}
                  </Txt>
                  <Txt muted>
                    Organizer:{" "}
                    {d.profiles.find((p: any) => p.id === a.event.created_by)
                      ?.full_name || "School organizer"}
                  </Txt>
                  <Txt muted>
                    {a.scanned_at
                      ? `Recorded: ${phDate(a.scanned_at)}`
                      : "No attendance time recorded"}
                  </Txt>
                  {a.corrected_at && <Badge value="Reviewed by admin" />}
                  <Text style={s.link}>View complete record →</Text>
                </Pressable>
              ))}
          </View>
        </View>
      ))}
      <Sheet
        title="Attendance Record"
        visible={!!selected}
        onClose={() => A(null)}
      >
        {selected && (
          <>
            <Badge value={selected.status} />
            <Text style={s.title}>
              {
                (
                  selected.event ||
                  d.events.find((e: any) => e.id === selected.event_id)
                )?.title
              }
            </Text>
            {(() => {
              const e =
                selected.event ||
                d.events.find((e: any) => e.id === selected.event_id);
              return (
                <>
                  <Txt>Event Code: {e?.event_code}</Txt>
                  <Txt>Venue: {e?.venue}</Txt>
                  <Txt>{e?.description}</Txt>
                  <Txt>
                    Schedule: {phDate(e?.start_time)} → {phDate(e?.end_time)}
                  </Txt>
                  <Txt>
                    Organizer:{" "}
                    {d.profiles.find((p: any) => p.id === e?.created_by)
                      ?.full_name || "School organizer"}
                  </Txt>
                </>
              );
            })()}
            <Txt>
              {selected.scanned_at
                ? `Recorded: ${phDate(selected.scanned_at)}`
                : "No attendance time recorded"}
            </Txt>
            {selected.corrected_at && (
              <>
                <Txt>Reviewed: {phDate(selected.corrected_at)}</Txt>
                <Txt>Reason: {selected.correction_reason}</Txt>
              </>
            )}
            <Button
              title="Report an Attendance Issue"
              secondary
              onPress={() => {
                A(null);
                router.push({
                  pathname: "/requests",
                  params: {
                    kind: "attendance",
                    event: selected.event_id,
                    student: selected.student_id,
                  },
                });
              }}
            />
          </>
        )}
      </Sheet>
    </Page>
  );
}
function TeacherAttendance() {
  const report = false;
  const d = useData(),
    notice = useNotice(),
    params = useLocalSearchParams(),
    [eid, E] = useState(String(params.event || "")),
    [search, S] = useState(""),
    [status, F] = useState("All"),
    [course, C] = useState("All Courses"),
    [year, Y] = useState("All Years"),
    [block, B] = useState("All Blocks"),
    [date, DT] = useState(""),
    [organizer, O] = useState("All Organizers"),
    [selected, A] = useState<any>(null),
    [newStatus, NS] = useState("present");
  useEffect(() => {
    if (params.event) E(String(params.event));
    if (params.status) F(String(params.status));
  }, [params.event, params.status]);
  const events = d.events
    .filter(
      (e: ScanEvent) => d.me?.role !== "teacher" || e.created_by === d.me.id,
    )
    .filter(
      (e: any) =>
        (!date ||
          phDate(e.start_time, false)
            .toLowerCase()
            .includes(date.toLowerCase())) &&
        (organizer === "All Organizers" || e.created_by === organizer),
    );
  const e = d.events.find((e: any) => e.id === eid);
  const rows = e
    ? studentRows(d, eid).filter(
        (a: any) =>
          (status === "All" || a.status === status.toLowerCase()) &&
          (course === "All Courses" || a.course === course) &&
          (year === "All Years" || a.course_year === year) &&
          (block === "All Blocks" || a.block === block) &&
          `${a.name} ${a.student_id_no}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      )
    : [];
  const allRows = e ? studentRows(d, eid) : [];
  const percent = rate(
    d.attendance,
    e ? [e] : events,
    d.event_audience,
    undefined,
    d.now,
  );
  async function download(excel: boolean) {
    const headers = [
      "Event",
      "Event Code",
      "Organizer",
      "Student",
      "Student ID",
      "Course",
      "Year",
      "Block",
      "Status",
      "Recorded (Philippine Time)",
      "Reviewed At",
      "Correction Reason",
    ];
    const records = (
      e ? rows : events.flatMap((ev: any) => studentRows(d, ev.id))
    ).map((a: any) => {
      const ev = d.events.find((x: any) => x.id === a.event_id);
      if (!ev)
        throw Error("Event details are unavailable. Refresh before exporting.");
      return [
        ev.title,
        ev.event_code,
        d.profiles.find((p: any) => p.id === ev.created_by)?.full_name || "",
        a.name,
        a.student_id_no,
        a.course,
        a.course_year,
        a.block,
        a.status,
        a.scanned_at ? phDate(a.scanned_at) : "",
        a.corrected_at ? phDate(a.corrected_at) : "",
        a.correction_reason || "",
      ];
    });
    if (!records.length) throw Error("No matching rows to export.");
    let res;
    if (excel) {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([headers, ...records]),
        "Attendance",
      );
      res = await exportExcel(excelFileName("ScanIn"), wb);
    } else
      res = await exportCsv(csvFileName("ScanIn"), buildCsv(headers, records));
    if (res.error) throw Error(res.error);
  }
  return (
    <Page
      back={report || !!eid}
      onBack={
        eid
          ? () => {
              E("");
              router.setParams({ event: undefined, status: undefined });
            }
          : undefined
      }
      title={report ? "Reports & Analytics" : "Event Attendance"}
      subtitle="View event rosters, attendance and summaries"
      onRefresh={d.reload}
      refreshing={d.loading}
    >
      <Field
        label="Filter event date"
        value={date}
        onChangeText={DT}
        placeholder="e.g. Oct 24, 2026"
      />
      {d.me?.role === "administrator" && (
        <>
          <Text style={s.label}>Organizer</Text>
          <View style={s.row}>
            <Button
              title="All Organizers"
              secondary
              onPress={() => O("All Organizers")}
            />
            {d.profiles
              .filter((p: any) => ["teacher", "administrator"].includes(p.role))
              .map((p: any) => (
                <Pressable
                  key={p.id}
                  onPress={() => O(p.id)}
                  style={[s.chip, organizer === p.id && s.chipOn]}
                >
                  <Txt>{p.full_name || p.email}</Txt>
                </Pressable>
              ))}
          </View>
        </>
      )}
      <View style={s.row}>
        <Button title="All Events" secondary onPress={() => E("")} />
        {events.map((ev: any) => (
          <Pressable
            key={ev.id}
            onPress={() => {
              E(ev.id);
              F("All");
            }}
            style={[s.chip, eid === ev.id && s.chipOn]}
          >
            <Txt>{ev.title}</Txt>
          </Pressable>
        ))}
      </View>
      {e ? (
        <>
          <View style={s.card}>
            <Text style={s.h}>{e.title}</Text>
            <Txt>{e.description}</Txt>
            <Txt muted>
              {e.event_code} · {e.venue} · {phase(e, d.now)}
            </Txt>
            <Txt muted>
              {phDate(e.start_time)} → {phDate(e.end_time)}
            </Txt>
            <Txt muted>
              Organizer:{" "}
              {d.profiles.find((p: any) => p.id === e.created_by)?.full_name}
            </Txt>
          </View>
          <View style={s.grid}>
            <Stat
              label={e.required ? "Expected Students" : "Eligible Students"}
              value={allRows.length}
            />
            {["present", "late", "absent", "not yet recorded"].map((v) => (
              <Stat
                key={v}
                label={v}
                value={allRows.filter((a: any) => a.status === v).length}
                onPress={() => F(v)}
              />
            ))}
          </View>
          {e.required && (
            <Txt>
              Attendance rate:{" "}
              {percent === null
                ? "Available after the event ends"
                : `${percent}%`}
            </Txt>
          )}
          <Breakdown rows={allRows} />
          <Field
            label="Search student"
            value={search}
            onChangeText={S}
            placeholder="Name or student ID"
          />
          <Chips
            items={["All", "present", "late", "absent", "not yet recorded"]}
            value={status}
            onChange={F}
          />
          <Chips
            items={["All Courses", ...(d.system_settings[0]?.courses || [])]}
            value={course}
            onChange={C}
          />
          <Chips
            items={["All Years", ...(d.system_settings[0]?.years || [])]}
            value={year}
            onChange={Y}
          />
          <Chips
            items={["All Blocks", ...(d.system_settings[0]?.blocks || [])]}
            value={block}
            onChange={B}
          />
          <View style={s.row}>
            <Button
              title="Export CSV"
              secondary
              onPress={() => notice.run(() => download(false))}
            />
            <Button
              title="Export Excel"
              secondary
              onPress={() => notice.run(() => download(true))}
            />
          </View>
          {!rows.length && <Empty title="No matching students" />}
          {rows.map((a: any) => (
            <Pressable
              key={a.student_id}
              onPress={() => {
                A(a);
                NS(a.status === "not yet recorded" ? "present" : a.status);
              }}
              style={s.card}
            >
              <View style={[s.row, { justifyContent: "space-between" }]}>
                <Text style={s.h}>{a.name}</Text>
                <Badge value={a.status} />
              </View>
              <Txt muted>
                {a.student_id_no} · {a.course} · {a.course_year} · Block{" "}
                {a.block}
              </Txt>
              <Txt muted>
                {a.scanned_at
                  ? `Recorded: ${phDate(a.scanned_at)}`
                  : "No attendance time recorded"}
              </Txt>
              {a.corrected_at && (
                <Txt muted>
                  Reviewed: {phDate(a.corrected_at)} · {a.correction_reason}
                </Txt>
              )}
            </Pressable>
          ))}
        </>
      ) : (
        <>
          <View style={s.grid}>
            <Stat
              label="Completed required event rate"
              value={percent === null ? "—" : `${percent}%`}
            />
            <Stat label="Events in view" value={events.length} />
          </View>
          <View style={s.row}>
            <Button
              title="Export all shown events · CSV"
              secondary
              onPress={() => notice.run(() => download(false))}
            />
            <Button
              title="Export all shown events · Excel"
              secondary
              onPress={() => notice.run(() => download(true))}
            />
          </View>
          {!events.length && <Empty title="No events to report" />}
          {events.map((ev: any) => {
            const ar = studentRows(d, ev.id),
              present = ar.filter((r: any) => r.status === "present").length,
              late = ar.filter((r: any) => r.status === "late").length,
              absent = ar.filter((r: any) => r.status === "absent").length;
            return (
              <Pressable key={ev.id} style={s.card} onPress={() => E(ev.id)}>
                <Text style={s.h}>{ev.title}</Text>
                <Txt muted>
                  {phDate(ev.start_time)} · {phase(ev, d.now)}
                </Txt>
                <Txt>
                  Present {present} · Late {late} · Absent {absent}
                </Txt>
                <Text style={s.link}>View event report →</Text>
              </Pressable>
            );
          })}
        </>
      )}
      <Sheet
        title="Student Attendance"
        visible={!!selected}
        onClose={() => A(null)}
      >
        {selected && (
          <>
            <Text style={s.h}>{selected.name}</Text>
            <Txt>
              {selected.student_id_no} · {selected.course} ·{" "}
              {selected.course_year} · {selected.block}
            </Txt>
            <Badge value={selected.status} />
            <Txt>
              {selected.scanned_at
                ? phDate(selected.scanned_at)
                : "No attendance time recorded"}
            </Txt>
            {d.me?.role === "administrator" ? (
              <>
                <Chips
                  items={["present", "late", "absent", "void"]}
                  value={newStatus}
                  onChange={NS}
                />
                <Txt muted>
                  Original scan time is preserved. Missing records never receive
                  an invented scan time. A voided required-event record may
                  become Absent at finalization.
                </Txt>
                <Button
                  title="Review & Correct Attendance"
                  onPress={() =>
                    notice.prompt(
                      "Correct attendance",
                      "Enter the verified reason for this correction.",
                      async (reason: string) => {
                        await d.act("scanin_correct", {
                          eid,
                          sid: selected.student_id,
                          new_status: newStatus,
                          why: reason,
                        });
                        A(null);
                      },
                    )
                  }
                />
              </>
            ) : (
              <Button
                title="Request Attendance Correction"
                onPress={() => {
                  A(null);
                  router.push({
                    pathname: "/requests",
                    params: {
                      kind: "attendance",
                      event: eid,
                      student: selected.student_id,
                    },
                  });
                }}
              />
            )}
          </>
        )}
      </Sheet>
      {report && (
        <>
          <Text style={s.h}>Monthly Check-ins</Text>
          {[
            ...new Set<string>(
              d.attendance
                .filter((a: any) => a.scanned_at)
                .map((a: any) => monthKey(a.scanned_at)),
            ),
          ]
            .sort()
            .reverse()
            .map((key) => {
              const n = d.attendance.filter(
                (a: any) =>
                  a.scanned_at &&
                  monthKey(a.scanned_at) === key &&
                  events.some((e: any) => e.id === a.event_id),
              ).length;
              return (
                <View key={key} style={s.card}>
                  <Txt>
                    {key} · {n} check-ins
                  </Txt>
                  <View
                    style={{
                      height: 9,
                      borderRadius: 8,
                      backgroundColor: "#D1FAE5",
                    }}
                  >
                    <View
                      style={{
                        height: 9,
                        borderRadius: 8,
                        backgroundColor: "#047857",
                        width: `${Math.min(100, (n / Math.max(1, d.attendance.length)) * 100)}%`,
                      }}
                    />
                  </View>
                </View>
              );
            })}
        </>
      )}
    </Page>
  );
}
export default function HistoryTab() {
  const { me } = useData();
  return me?.role === "student" ? <StudentHistory /> : <TeacherAttendance />;
}
