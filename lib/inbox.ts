import type { Href } from "expo-router";
import type {
  CorrectionRequest,
  NotificationRecord,
  Profile,
} from "@/lib/types";

type Account = Profile | null;

export function ownNotifications(
  rows: NotificationRecord[],
  me: Account,
) {
  return rows.filter(
    (row) => !!me && row.user_id === me.id,
  );
}

export function visibleRequests(
  rows: CorrectionRequest[],
  me: Account,
) {
  return rows.filter(
    (row) =>
      !!me &&
      (me.role === "administrator" ||
        row.requester_id === me.id),
  );
}

export function pendingCount(
  rows: CorrectionRequest[],
  me: Account,
) {
  return visibleRequests(rows, me).filter(
    (row) => row.status === "pending",
  ).length;
}

export function countLabel(count: number) {
  return count > 9 ? "9+" : String(count);
}

export function requestLabel(
  status: CorrectionRequest["status"],
) {
  return status === "resolved"
    ? "Approved"
    : status === "declined"
      ? "Declined"
      : "Pending";
}

export function phDateKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));

  const get = (name: string) =>
    parts.find((part) => part.type === name)?.value;

  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function notificationGroup(
  created: string,
  now: number,
) {
  return phDateKey(created) ===
    phDateKey(new Date(now).toISOString())
    ? "Today"
    : "Earlier";
}

export function notificationDestination(
  notification: NotificationRecord,
  me: Account,
): Href {
  if (notification.request_id) {
    return {
      pathname: "/requests",
      params: {
        request: notification.request_id,
      },
    };
  }

  if (notification.event_id) {
    if (
      notification.dedupe_key.startsWith("correction:") &&
      me?.role === "student"
    ) {
      return {
        pathname: "/(tabs)/history",
        params: {
          event: notification.event_id,
        },
      };
    }

    if (
      notification.dedupe_key.startsWith("summary:")
    ) {
      if (me?.role === "administrator") {
        return {
          pathname: "/admin/reports",
          params: {
            event: notification.event_id,
          },
        };
      }

      if (me?.role === "teacher") {
        return {
          pathname: "/(tabs)/history",
          params: {
            event: notification.event_id,
          },
        };
      }
    }

    return {
      pathname: "/event-details",
      params: {
        event: notification.event_id,
      },
    };
  }

  if (
    me?.role === "administrator" &&
    notification.dedupe_key.startsWith("teacher:")
  ) {
    return {
      pathname: "/admin/users",
      params: {
        role: "teacher",
        status: "pending",
      },
    };
  }

  return me?.role === "administrator"
    ? "/admin/profile"
    : "/(tabs)/profile";
}