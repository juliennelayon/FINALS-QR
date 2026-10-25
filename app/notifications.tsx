import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useData } from "@/lib/AppData";
import { phDate } from "@/lib/domain";
import {
  notificationDestination,
  notificationGroup,
  ownNotifications,
} from "@/lib/inbox";
import {
  Badge,
  Button,
  Chips,
  Empty,
  Page,
  Txt,
  s,
} from "@/components/Kit";
import { useNotice } from "@/components/Notice";

export default function NotificationsScreen() {
  const d = useData();
  const notice = useNotice();

  const [filter, setFilter] = useState("All");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  const own = ownNotifications(
    d.notifications,
    d.me,
  );

  const unread = own.filter(
    (notification) => !notification.read_at,
  ).length;

  const rows = own
    .filter(
      (notification) =>
        filter === "All" || !notification.read_at,
    )
    .sort(
      (a, b) =>
        Date.parse(b.created_at) -
        Date.parse(a.created_at),
    );

  async function run(action: () => Promise<void>) {
    if (lock.current) return;

    lock.current = true;
    setBusy(true);

    try {
      await action();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <Page
      back
      title="Notifications"
      subtitle={`${unread} unread · Philippine Time`}
      onRefresh={d.reload}
      refreshing={d.loading}
      onBack={() =>
        router.replace(
          d.me?.role === "administrator"
            ? "/admin"
            : "/(tabs)",
        )
      }
    >
      <Chips
        items={["All", "Unread"]}
        value={filter}
        onChange={setFilter}
      />

      <Button
        title={busy ? "Updating…" : "Mark All as Read"}
        secondary
        disabled={busy || unread === 0}
        onPress={() =>
          notice.run(() =>
            run(async () => {
              await d.act("scanin_mark_read", {
                nid: null,
              });
            }),
          )
        }
      />

      {!!d.errors.notifications && (
        <View style={s.card}>
          <Text style={s.error}>
            Notifications could not refresh. Previously
            loaded notifications may be out of date.
          </Text>

          <Button
            title="Retry"
            secondary
            disabled={d.loading}
            onPress={() => void d.reload()}
          />
        </View>
      )}

      {!rows.length &&
        !d.loading &&
        !d.errors.notifications && (
          <Empty
            title="You’re all caught up"
            body={
              filter === "Unread"
                ? "No unread notifications."
                : "New notifications will appear here."
            }
          />
        )}

      {(["Today", "Earlier"] as const).map((group) => {
        const items = rows.filter(
          (notification) =>
            notificationGroup(
              notification.created_at,
              d.now,
            ) === group,
        );

        if (!items.length) return null;

        return (
          <View key={group} style={{ gap: 12 }}>
            <Text style={s.h}>{group}</Text>

            {items.map((notification) => (
              <Pressable
                key={notification.id}
                accessibilityRole="button"
                accessibilityLabel={`Open notification: ${notification.title}`}
                disabled={busy}
                onPress={() =>
                  notice.run(() =>
                    run(async () => {
                      if (!notification.read_at) {
                        await d.act("scanin_mark_read", {
                          nid: notification.id,
                        });
                      }

                      router.push(
                        notificationDestination(
                          notification,
                          d.me,
                        ),
                      );
                    }),
                  )
                }
                style={({ pressed }) => [
                  s.card,
                  {
                    borderLeftWidth:
                      notification.read_at ? 1 : 4,
                    borderLeftColor:
                      notification.read_at
                        ? "#C9DFD5"
                        : "#047857",
                    opacity:
                      pressed || busy ? 0.65 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    s.row,
                    { justifyContent: "space-between" },
                  ]}
                >
                  <Ionicons
                    name={
                      notification.request_id
                        ? "document-text-outline"
                        : notification.event_id
                          ? "calendar-outline"
                          : "notifications-outline"
                    }
                    size={23}
                    color="#047857"
                  />

                  {!notification.read_at && (
                    <Badge value="New" />
                  )}
                </View>

                <Text style={s.h}>
                  {notification.title}
                </Text>

                <Txt>{notification.body}</Txt>

                <Txt muted>
                  {phDate(notification.created_at)}
                </Txt>

                <Text style={s.link}>
                  Open details →
                </Text>
              </Pressable>
            ))}
          </View>
        );
      })}
    </Page>
  );
}