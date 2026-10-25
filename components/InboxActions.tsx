import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useData } from "@/lib/AppData";
import { COLORS } from "@/constants/colors";
import { Avatar } from "@/components/Kit";
import {
  countLabel,
  ownNotifications,
  pendingCount,
} from "@/lib/inbox";

export function HomeInboxActions() {
  const d = useData();
  const me = d.me;

  if (!me) return null;

  const unread = ownNotifications(
    d.notifications,
    me,
  ).filter((notification) => !notification.read_at).length;

  const failed = !!d.errors.notifications;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open profile"
        onPress={() =>
          router.push(
            me.role === "administrator"
              ? "/admin/profile"
              : "/(tabs)/profile",
          )
        }
      >
        <Avatar
          url={me.avatar_url}
          name={me.full_name}
        />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          failed
            ? "Open notifications. Refresh needed."
            : `Open notifications. ${unread} unread.`
        }
        onPress={() => router.push("/notifications")}
        style={({ pressed }) => ({
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: COLORS.surface,
          opacity: pressed ? 0.65 : 1,
        })}
      >
        <Ionicons
          name="notifications-outline"
          size={25}
          color={COLORS.primary}
        />

        {(unread > 0 || failed) && (
          <View
            style={{
              position: "absolute",
              right: -2,
              top: -2,
              minWidth: 23,
              height: 23,
              paddingHorizontal: 5,
              borderRadius: 12,
              backgroundColor: failed
                ? "#92400E"
                : "#DC2626",
              borderWidth: 2,
              borderColor: COLORS.card,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 11,
                fontWeight: "800",
              }}
            >
              {failed ? "!" : countLabel(unread)}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

export function RequestsButton({
  center = false,
}: {
  center?: boolean;
}) {
  const d = useData();
  const admin = d.me?.role === "administrator";

  if (!d.me || (admin && !center)) {
    return null;
  }

  const count = pendingCount(d.requests, d.me);
  const failed = !!d.errors.requests;
  const title = admin ? "Requests Center" : "My Requests";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${
        failed ? "Refresh needed" : `${count} pending`
      }`}
      onPress={() =>
        router.push({
          pathname: "/requests",
          params: { status: "pending" },
        })
      }
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 52,
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor:
          count || failed ? "#EAB308" : COLORS.border,
        backgroundColor:
          count || failed ? "#FFFBEB" : COLORS.surface,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <Ionicons
        name="document-text-outline"
        size={22}
        color={COLORS.primary}
      />

      <Text
        style={{
          flex: 1,
          color: COLORS.textPrimary,
          fontWeight: "700",
          fontSize: 15,
        }}
      >
        {title}
      </Text>

      {(count > 0 || failed) && (
        <View
          style={{
            backgroundColor: "#FDE68A",
            minWidth: 27,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 14,
          }}
        >
          <Text
            style={{
              color: "#78350F",
              fontWeight: "800",
              textAlign: "center",
            }}
          >
            {failed ? "!" : countLabel(count)}
          </Text>
        </View>
      )}

      <Ionicons
        name="chevron-forward"
        size={18}
        color={COLORS.textSecondary}
      />
    </Pressable>
  );
}

export function PendingRequestsCard() {
  const d = useData();

  if (d.me?.role !== "administrator") {
    return null;
  }

  const count = pendingCount(d.requests, d.me);
  const failed = !!d.errors.requests;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Pending Requests: ${
        failed ? "Refresh needed" : count
      }`}
      onPress={() =>
        router.push({
          pathname: "/requests",
          params: { status: "pending" },
        })
      }
      style={({ pressed }) => ({
        width: "48%",
        minHeight: 158,
        padding: 18,
        gap: 10,
        borderRadius: 20,
        borderWidth: 2,
        borderColor:
          count || failed ? "#EAB308" : COLORS.border,
        backgroundColor:
          count || failed ? "#FFFBEB" : COLORS.card,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <Ionicons
        name="document-text-outline"
        size={28}
        color={
          count || failed ? "#92400E" : COLORS.primary
        }
      />

      <Text
        style={{
          fontSize: 32,
          fontWeight: "800",
          marginTop: 8,
          color:
            count || failed
              ? "#92400E"
              : COLORS.textPrimary,
        }}
      >
        {failed ? "—" : count}
      </Text>

      <Text
        style={{
          color: COLORS.textSecondary,
          fontSize: 14,
          fontWeight: "500",
        }}
      >
        Pending Requests
      </Text>
    </Pressable>
  );
}