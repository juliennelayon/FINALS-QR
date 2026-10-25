import assert from "node:assert/strict";
import { backDestination } from "../lib/navigation";
const cases = [
  ["/notifications", "student", "/"],
  ["/notifications", "teacher", "/"],
  ["/notifications", "administrator", "/admin"],
  ["/requests", "student", "/profile"],
  ["/requests", "administrator", "/admin/profile"],
  ["/admin/reports", "administrator", "/admin/tools"],
  ["/admin/logs", "administrator", "/admin/tools"],
  ["/admin/settings", "administrator", "/admin/tools"],
  ["/admin/tools", "administrator", "/admin"],
  ["/admin/profile", "administrator", "/admin"],
  ["/forgot-password", undefined, "/login"],
  ["/reset-password", undefined, "/login"],
  ["/register", undefined, "/login"],
  ["/scan", "student", "/events"],
] as const;
for (const [path, role, expected] of cases)
  assert.equal(backDestination(path, role), expected);
console.log(`${cases.length} back-navigation checks passed`);
