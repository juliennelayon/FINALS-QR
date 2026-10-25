import { Pressable, Text, View } from "react-native";
import { router, type Href } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Button, Page } from "@/components/Kit";
import {
  PendingRequestsCard,
  RequestsButton,
} from "@/components/InboxActions";
import { COLORS } from "@/constants/colors";
import { useData } from "@/lib/AppData";
import { phase } from "@/lib/domain";

type Tone =
  | "neutral"
  | "danger"
  | "warning"
  | "success";

type Item = {
  title: string;
  count: number;
  icon: keyof typeof Ionicons.glyphMap;
  tone: Tone;
  route: Href;
};

const tones = {
  neutral: {
    border: COLORS.border,
    icon: COLORS.primary,
    background: COLORS.card,
  },
  danger: {
    border: "#DC2626",
    icon: "#B91C1C",
    background: "#FFF7F7",
  },
  warning: {
    border: "#EAB308",
    icon: "#854D0E",
    background: "#FFFCF0",
  },
  success: {
    border: "#16A34A",
    icon: "#15803D",
    background: "#F0FDF4",
  },
};

export default function AdminPanel() {
  const d = useData();

  const events = d.events.filter(
    (event) => !event.archived,
  );

  const pending = d.profiles.filter(
    (profile) =>
      profile.status === "pending" &&
      !profile.suspended,
  ).length;

  const open = events.filter(
    (event) =>
      event.status === "open" &&
      phase(event, d.now) === "Ongoing",
  ).length;

  const present = d.attendance.filter(
    (record) => record.status === "present",
  ).length;

  const late = d.attendance.filter(
    (record) => record.status === "late",
  ).length;

  const absent = d.attendance.filter(
    (record) => record.status === "absent",
  ).length;

  const items: Item[] = [
    {
      title: "Total Users",
      count: d.profiles.length,
      icon: "people-outline",
      tone: "neutral",
      route: {
        pathname: "/admin/users",
        params: {
          role: "All Roles",
          status: "All Statuses",
        },
      },
    },
    {
      title: "Pending Approval",
      count: pending,
      icon: "alert-circle-outline",
      tone: pending ? "danger" : "neutral",
      route: {
        pathname: "/admin/users",
        params: {
          role: "All Roles",
          status: "pending",
        },
      },
    },
    {
      title: "Total Events",
      count: events.length,
      icon: "calendar-outline",
      tone: "neutral",
      route: {
        pathname: "/admin/events",
        params: { overview: "all" },
      },
    },
    {
      title: "Open Events",
      count: open,
      icon: "lock-open-outline",
      tone: open ? "success" : "neutral",
      route: {
        pathname: "/admin/events",
        params: { overview: "open" },
      },
    },
    {
      title: "Attendance Records",
      count: d.attendance.length,
      icon: "checkmark-done-outline",
      tone: "neutral",
      route: {
        pathname: "/admin/attendance",
        params: { event: "", status: "All" },
      },
    },
    {
      title: "Present",
      count: present,
      icon: "checkmark-outline",
      tone: present ? "success" : "neutral",
      route: {
        pathname: "/admin/attendance",
        params: { event: "", status: "Present" },
      },
    },
    {
      title: "Late",
      count: late,
      icon: "time-outline",
      tone: late ? "warning" : "neutral",
      route: {
        pathname: "/admin/attendance",
        params: { event: "", status: "Late" },
      },
    },
    {
      title: "Absent",
      count: absent,
      icon: "close-outline",
      tone: absent ? "danger" : "neutral",
      route: {
        pathname: "/admin/attendance",
        params: { event: "", status: "Absent" },
      },
    },
  ];

  const connection =
    tones[
      d.live === "live"
        ? "success"
        : d.live === "connecting"
          ? "warning"
          : "danger"
    ];

  return (
    <Page
      back
      title="Admin Panel"
      onBack={() => router.replace("/admin/profile")}
      onRefresh={d.reload}
      refreshing={d.loading}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            fontSize: 21,
            fontWeight: "700",
            color: COLORS.textPrimary,
          }}
        >
          Overview
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: connection.border,
            backgroundColor: connection.background,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: connection.icon,
            }}
          />

          <Text
            style={{
              color: connection.icon,
              fontSize: 12,
              fontWeight: "600",
            }}
          >
            {d.live === "live"
              ? "Live"
              : d.live === "connecting"
                ? "Connecting"
                : "Reconnect needed"}
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          rowGap: 12,
        }}
      >
        {items.map((item) => {
          const tone = tones[item.tone];

          return (
            <Pressable
              key={item.title}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}: ${item.count}`}
              onPress={() => router.push(item.route)}
              style={({ pressed }) => ({
                width: "48%",
                minHeight: 158,
                padding: 18,
                gap: 10,
                borderRadius: 20,
                borderWidth: 2,
                borderColor: tone.border,
                backgroundColor: tone.background,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons
                name={item.icon}
                size={28}
                color={tone.icon}
              />

              <Text
                style={{
                  fontSize: 32,
                  fontWeight: "800",
                  marginTop: 8,
                  color:
                    item.tone === "neutral"
                      ? COLORS.textPrimary
                      : tone.icon,
                }}
              >
                {item.count}
              </Text>

              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "500",
                  color: COLORS.textSecondary,
                }}
              >
                {item.title}
              </Text>
            </Pressable>
          );
        })}

        <PendingRequestsCard />
      </View>

      <View
        style={{
          gap: 12,
          marginTop: 24,
          marginBottom: 20,
        }}
      >
        <Text
          style={{
            fontSize: 21,
            fontWeight: "700",
            color: COLORS.textPrimary,
            alignSelf: "flex-start",
          }}
        >
          Manage
        </Text>

        <Button
          title="Reports & Analytics"
          icon="bar-chart-outline"
          secondary
          onPress={() => router.push("/admin/reports")}
        />

        <RequestsButton center />

        <Button
          title="Activity Logs"
          icon="time-outline"
          secondary
          onPress={() => router.push("/admin/logs")}
        />

        <Button
          title="System Settings"
          icon="settings-outline"
          secondary
          onPress={() => router.push("/admin/settings")}
        />
      </View>
    </Page>
  );
}