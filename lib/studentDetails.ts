import type { StudentDetails } from "./types";
const required = [
  "student_id_no",
  "course",
  "course_year",
  "block",
  "gender",
  "email",
  "phone",
] as const;
export function isCompleteStudentDetails(
  profile: StudentDetails | null | undefined,
): profile is StudentDetails {
  if (!profile) return false;
  return required.every((key) => {
    const value = profile[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}
export function readField(value: object | undefined, key: string): unknown {
  return value && Object.prototype.hasOwnProperty.call(value, key)
    ? Reflect.get(value, key)
    : undefined;
}
