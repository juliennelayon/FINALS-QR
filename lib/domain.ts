import type { EventRecord, AttendanceRecord, EventAssignment } from "./types";
export type ScanEvent = EventRecord;
export function phase(
  e: Pick<ScanEvent, "status" | "start_time" | "end_time">,
  now = Date.now(),
): string {
  if (e.status === "cancelled") return "Cancelled";
  if (e.status === "draft") return "Draft";
  if (e.end_time && now >= Date.parse(e.end_time)) return "Ended";
  if (e.status === "closed") return "Closed";
  if (e.start_time && now < Date.parse(e.start_time)) return "Upcoming";
  return "Ongoing";
}
export function phDate(v: string | null | undefined, withTime = true) {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}
export function monthKey(v: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
  }).format(new Date(v));
}
export function monthLabel(v: string) {
  return new Date(v).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "long",
    year: "numeric",
  });
}
export function remaining(e: ScanEvent, now = Date.now()) {
  if (phase(e, now) !== "Ongoing" || !e.end_time) return "";
  return `Ends in ${Math.max(1, Math.ceil((Date.parse(e.end_time) - now) / 60000))} min`;
}
export function audience(e: ScanEvent) {
  return [
    e.audience_course || "All courses",
    e.audience_year || "All years",
    e.audience_block ? `Block ${e.audience_block}` : "All blocks",
  ].join(" · ");
}
export function rate(
  att: Pick<AttendanceRecord, "event_id" | "student_id" | "status">[],
  events: ScanEvent[],
  expected: EventAssignment[],
  studentId?: string,
  now = Date.now(),
) {
  const completed = new Set(
    events
      .filter(
        (e) =>
          e.required &&
          e.status !== "cancelled" &&
          e.end_time &&
          Date.parse(e.end_time) <= now,
      )
      .map((e) => e.id),
  );
  const rows = expected.filter(
    (x) =>
      completed.has(x.event_id) && (!studentId || x.student_id === studentId),
  );
  const attended = rows.filter((x) =>
    att.some(
      (a) =>
        a.event_id === x.event_id &&
        a.student_id === x.student_id &&
        ["present", "late"].includes(a.status),
    ),
  );
  return rows.length ? Math.round((attended.length / rows.length) * 100) : null;
}
export function phInput(v: string | null) {
  return v
    ? new Date(Date.parse(v) + 8 * 3600000)
        .toISOString()
        .slice(0, 16)
        .replace("T", " ")
    : "";
}
export function parsePH(v: string) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(v))
    throw Error("Use YYYY-MM-DD HH:mm (Philippine Time).");
  const d = new Date(v.replace(" ", "T") + ":00+08:00");
  if (!Number.isFinite(d.getTime()) || phInput(d.toISOString()) !== v)
    throw Error("Enter a valid date and time.");
  return d.toISOString();
}

/** Preserve legacy seconds when an organizer leaves the displayed minute unchanged. */
export function eventDateTime(
  draft: string,
  original: string | null | undefined,
): string {
  return original && draft === phInput(original) ? original : parsePH(draft);
}
