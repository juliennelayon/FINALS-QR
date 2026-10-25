export type Role = "student" | "teacher" | "administrator";
export type ProfileStatus = "pending" | "approved" | "rejected";
export type AttendanceStatus = "present" | "late" | "absent";
export type Json =
  string | number | boolean | null | Json[] | { [key: string]: Json };
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  status: ProfileStatus;
  suspended: boolean;
  avatar_url: string | null;
  status_reason: string | null;
  reminder_start: boolean;
  reminder_end: boolean;
  created_at?: string;
}
export interface StudentDetails {
  user_id: string;
  student_id_no: string;
  course: string | null;
  course_year: string | null;
  block: string | null;
  gender: string | null;
  age: number | null;
  email: string | null;
  phone: string | null;
}
export interface EventRecord {
  id: string;
  event_code: string;
  title: string;
  venue: string | null;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  status: "draft" | "open" | "closed" | "cancelled";
  created_by: string | null;
  created_at: string;
  required: boolean;
  audience_course: string | null;
  audience_year: string | null;
  audience_block: string | null;
  late_minutes: number;
  archived: boolean;
  cancel_reason?: string | null;
  roster_frozen?: boolean;
  creator_name?: string;
}
export interface AttendanceRecord {
  id: string;
  event_id: string;
  student_id: string;
  status: AttendanceStatus;
  scanned_at: string | null;
  source: string;
  corrected_at: string | null;
  correction_reason: string | null;
}
export interface EventAssignment {
  event_id: string;
  student_id: string;
}
export interface CorrectionRequest {
  id: string;
  requester_id: string;
  kind: "profile" | "attendance" | "event";
  event_id: string | null;
  student_id: string | null;
  payload: Record<string, Json>;
  reason: string;
  attachment: string | null;
  status: "pending" | "resolved" | "declined";
  response: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}
export interface NotificationRecord {
  id: string;
  user_id: string;
  title: string;
  body: string;
  event_id: string | null;
  request_id: string | null;
  read_at: string | null;
  created_at: string;
  dedupe_key: string;
  push_sent: boolean;
}
export interface AuditEntry {
  id: number;
  actor_id: string | null;
  action: string;
  record_type: string;
  record_id: string | null;
  old_value: Json;
  new_value: Json;
  reason: string | null;
  created_at: string;
}
export interface Settings {
  id: number;
  courses: string[];
  years: string[];
  blocks: string[];
  late_minutes: number;
  reminder_start_minutes: number;
  reminder_end_minutes: number;
}
export interface TableRows {
  profiles: Profile;
  student_profiles: StudentDetails;
  events: EventRecord;
  attendance: AttendanceRecord;
  event_audience: EventAssignment;
  saved_events: EventAssignment;
  requests: CorrectionRequest;
  notifications: NotificationRecord;
  audit_log: AuditEntry;
  system_settings: Settings;
}
export type TableName = keyof TableRows;
export type DataState = { [K in TableName]: TableRows[K][] };
export interface AttendanceResult {
  duplicate: boolean;
  event_id: string;
  title: string;
  status: AttendanceStatus;
  scanned_at: string | null;
}
export interface AppContextValue extends DataState {
  me: Profile | null;
  loading: boolean;
  ready: boolean;
  error: string;
  errors: Partial<Record<TableName | "sync", string>>;
  updated: string;
  now: number;
  live: "connecting" | "live" | "error";
  reload: () => Promise<void>;
  act: <T = unknown>(name: string, args: Record<string, unknown>) => Promise<T>;
}
