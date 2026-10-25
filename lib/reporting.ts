import type {
  AppContextValue,
  EventRecord,
} from "@/lib/types";

export type ReportStatus =
  | "present"
  | "late"
  | "absent"
  | "not yet recorded";

export type Filters = {
  event: string;
  organizer: string;
  month: string;
  from: string;
  to: string;
  course: string;
  year: string;
  block: string;
  status: string;
  search: string;
};

export const emptyFilters: Filters = {
  event: "",
  organizer: "",
  month: "",
  from: "",
  to: "",
  course: "",
  year: "",
  block: "",
  status: "",
  search: "",
};

export type ReportRow = {
  event: EventRecord;
  studentId: string;
  name: string;
  schoolId: string;
  course: string;
  year: string;
  block: string;
  status: ReportStatus;
  scanned: string | null;
  corrected: string | null;
  reason: string;
};

export type Ranking = {
  studentId: string;
  name: string;
  schoolId: string;
  course: string;
  year: string;
  block: string;
  expected: number;
  present: number;
  late: number;
  absent: number;
  unrecorded: number;
  attended: number;
  rate: number;
  rank: number;
};

export function phDay(value: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));

  const part = (name: string) =>
    parts.find((item) => item.type === name)?.value;

  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function validateDates(filters: Filters) {
  for (const value of [filters.from, filters.to]) {
    if (!value) continue;

    const time = Date.parse(
      `${value}T00:00:00+08:00`,
    );

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(time) ||
      phDay(new Date(time).toISOString()) !== value
    ) {
      throw new Error(
        "Use valid dates in YYYY-MM-DD format.",
      );
    }
  }

  if (
    filters.from &&
    filters.to &&
    filters.from > filters.to
  ) {
    throw new Error(
      "From date must not be after To date.",
    );
  }
}

export function allowedEvents(
  d: AppContextValue,
): EventRecord[] {
  const me = d.me;

  if (
    !me ||
    me.suspended ||
    me.status !== "approved"
  ) {
    return [];
  }

  if (me.role === "administrator") {
    return d.events;
  }

  if (me.role === "teacher") {
    return d.events.filter(
      (event) => event.created_by === me.id,
    );
  }

  const ids = new Set([
    ...d.event_audience
      .filter((item) => item.student_id === me.id)
      .map((item) => item.event_id),
    ...d.attendance
      .filter((item) => item.student_id === me.id)
      .map((item) => item.event_id),
  ]);

  return d.events.filter((event) => ids.has(event.id));
}

export function selectEvents(
  d: AppContextValue,
  filters: Filters,
  ranking = false,
) {
  return allowedEvents(d).filter((event) => {
    const date = phDay(
      event.start_time || event.created_at,
    );

    return (
      (!filters.event || event.id === filters.event) &&
      (!filters.organizer ||
        event.created_by === filters.organizer) &&
      (!filters.month || date.startsWith(filters.month)) &&
      (!filters.from || date >= filters.from) &&
      (!filters.to || date <= filters.to) &&
      (!ranking ||
        (event.required &&
          event.status !== "draft" &&
          event.status !== "cancelled" &&
          !!event.end_time &&
          Date.parse(event.end_time) <= d.now))
    );
  });
}

export function reportRows(
  d: AppContextValue,
  events: EventRecord[],
): ReportRow[] {
  const allowed = new Set(
    allowedEvents(d).map((event) => event.id),
  );

  const profiles = new Map(
    d.profiles.map((profile) => [profile.id, profile]),
  );

  const details = new Map(
    d.student_profiles.map((profile) => [
      profile.user_id,
      profile,
    ]),
  );

  const records = new Map(
    d.attendance.map((record) => [
      `${record.event_id}:${record.student_id}`,
      record,
    ]),
  );

  return events
    .filter((event) => allowed.has(event.id))
    .flatMap((event) => {
      const students = new Set([
        ...d.event_audience
          .filter((item) => item.event_id === event.id)
          .map((item) => item.student_id),
        ...d.attendance
          .filter((item) => item.event_id === event.id)
          .map((item) => item.student_id),
      ]);

      return [...students]
        .filter(
          (id) =>
            d.me?.role !== "student" || id === d.me.id,
        )
        .map((id) => {
          const profile = profiles.get(id);
          const student = details.get(id);
          const record = records.get(`${event.id}:${id}`);

          return {
            event,
            studentId: id,
            name: profile?.full_name || "Student",
            schoolId: student?.student_id_no || "—",
            course: student?.course || "—",
            year: student?.course_year || "—",
            block: student?.block || "—",
            status: record?.status || "not yet recorded",
            scanned: record?.scanned_at || null,
            corrected: record?.corrected_at || null,
            reason: record?.correction_reason || "",
          };
        });
    });
}

export function filterRows(
  rows: ReportRow[],
  filters: Filters,
  all = false,
  ranking = false,
) {
  if (all) return rows;

  return rows.filter(
    (row) =>
      (!filters.course || row.course === filters.course) &&
      (!filters.year || row.year === filters.year) &&
      (!filters.block || row.block === filters.block) &&
      (ranking ||
        !filters.status ||
        row.status === filters.status) &&
      `${row.name} ${row.schoolId}`
        .toLowerCase()
        .includes(filters.search.trim().toLowerCase()),
  );
}

export function totals(rows: ReportRow[]) {
  const count = (status: ReportStatus) =>
    rows.filter((row) => row.status === status).length;

  const present = count("present");
  const late = count("late");

  return {
    expected: rows.length,
    students: new Set(rows.map((row) => row.studentId)).size,
    present,
    late,
    absent: count("absent"),
    unrecorded: count("not yet recorded"),
    rate: rows.length
      ? (present + late) / rows.length
      : null,
  };
}

export function topAttendees(
  rows: ReportRow[],
): Ranking[] {
  const groups = new Map<string, ReportRow[]>();

  for (const row of rows) {
    groups.set(row.studentId, [
      ...(groups.get(row.studentId) || []),
      row,
    ]);
  }

  const result = [...groups.values()].map(
    (group): Ranking => {
      const student = group[0];
      const summary = totals(group);

      return {
        studentId: student.studentId,
        name: student.name,
        schoolId: student.schoolId,
        course: student.course,
        year: student.year,
        block: student.block,
        expected: summary.expected,
        present: summary.present,
        late: summary.late,
        absent: summary.absent,
        unrecorded: summary.unrecorded,
        attended: summary.present + summary.late,
        rate: summary.rate || 0,
        rank: 0,
      };
    },
  );

  const compare = (a: Ranking, b: Ranking) =>
    b.attended * a.expected -
      a.attended * b.expected ||
    b.attended - a.attended ||
    a.late - b.late;

  result.sort(
    (a, b) =>
      compare(a, b) ||
      a.name.localeCompare(b.name) ||
      a.studentId.localeCompare(b.studentId),
  );

  result.forEach((student, index) => {
    student.rank =
      index &&
      compare(result[index - 1], student) === 0
        ? result[index - 1].rank
        : index + 1;
  });

  return result.filter((student) => student.rank <= 10);
}