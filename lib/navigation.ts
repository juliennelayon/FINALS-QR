export type AccountRole = "student" | "teacher" | "administrator";
/** Parent destination when a page was opened directly without history. */
export function backDestination(
  path: string,
  role: AccountRole | undefined,
): string {
  if (["/register", "/forgot-password", "/reset-password"].includes(path))
    return "/login";
  if (["/admin/reports", "/admin/logs", "/admin/settings"].includes(path))
    return "/admin/tools";
  if (path === "/admin/tools" || path.startsWith("/admin/")) return "/admin";
  if (path === "/requests")
    return role === "administrator" ? "/admin/profile" : "/profile";
  if (path === "/scan") return "/events";
  return role === "administrator" ? "/admin" : "/";
}
