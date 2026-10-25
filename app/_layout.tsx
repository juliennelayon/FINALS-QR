import { Stack, router, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import {
  ActivityIndicator,
  Platform,
  Text,
  View,
} from "react-native";
import * as Linking from "expo-linking";
import Constants from "expo-constants";

import {
  AppDataProvider,
  useData,
} from "@/lib/AppData";
import { useAuth, signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { clearCreds } from "@/lib/credentials";
import { NoticeProvider } from "@/components/Notice";
import { Button, s } from "@/components/Kit";

function Shell() {
  const { session, loading: authLoading } = useAuth();
  const d = useData();
  const segments = useSegments();
  const url = Linking.useURL();

  const path = segments[0];

  useEffect(() => {
    void clearCreds();
  }, []);

  useEffect(() => {
    if (!url) return;

    const normalized = url.replace("#", "?");

    const params = new URLSearchParams(
      normalized.split("?").slice(1).join("?"),
    );

    const access = params.get("access_token");
    const refresh = params.get("refresh_token");
    const code = params.get("code");

    if (access && refresh) {
      void supabase.auth.setSession({
        access_token: access,
        refresh_token: refresh,
      });
    } else if (code) {
      void supabase.auth.exchangeCodeForSession(code);
    }
  }, [url]);

  useEffect(() => {
    if (
      Platform.OS === "web" ||
      Constants.appOwnership === "expo"
    ) {
      return;
    }

    let cleanup: undefined | (() => void);
    let alive = true;

    void import("expo-notifications").then((notifications) => {
      if (!alive) return;

      notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });

      const subscription =
        notifications.addNotificationResponseReceivedListener(
          () => router.push("/notifications"),
        );

      cleanup = () => subscription.remove();

      notifications
        .getLastNotificationResponseAsync()
        .then((response) => {
          if (response && alive) {
            router.push("/notifications");
          }
        });
    });

    return () => {
      alive = false;
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;

    const publicRoute = [
      "login",
      "register",
      "forgot-password",
      "reset-password",
    ].includes(String(path));

    if (!session) {
      if (!publicRoute) {
        router.replace("/login");
      }

      return;
    }

    if (path === "reset-password") return;
    if (d.loading || !d.me) return;

    const me = d.me;

    if (me.status !== "approved" || me.suspended) {
      if (path !== "pending") {
        router.replace("/pending");
      }

      return;
    }

    if (me.role === "administrator") {
      if (
        publicRoute ||
        path === "pending" ||
        path === "(tabs)"
      ) {
        router.replace("/admin");
      }
    } else if (
      publicRoute ||
      path === "pending" ||
      path === "admin"
    ) {
      router.replace("/(tabs)");
    } else if (
      me.role === "teacher" &&
      (segments as string[])[1] === "scan"
    ) {
      router.replace("/(tabs)");
    } else if (
      me.role === "student" &&
      (segments as string[])[1] === "teacher"
    ) {
      router.replace("/(tabs)/events");
    } else if (
      me.role === "teacher" &&
      (segments as string[])[1] === "events"
    ) {
      router.replace("/(tabs)/teacher");
    }
  }, [
    session,
    authLoading,
    d.loading,
    d.me?.id,
    d.me?.role,
    d.me?.status,
    d.me?.suspended,
    path,
    segments.join("/"),
  ]);

  if (
    authLoading ||
    (session && !d.me && !d.error)
  ) {
    return (
      <View
        style={[
          s.page,
          {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          },
        ]}
      >
        <StatusBar style="dark" />

        <View
          style={{
            width: "100%",
            maxWidth: 420,
            alignItems: "center",
            gap: 16,
          }}
        >
          <ActivityIndicator
            size="large"
            color="#047857"
          />

          <Text
            style={[
              s.muted,
              { textAlign: "center" },
            ]}
          >
            Opening ScanIn…
          </Text>
        </View>
      </View>
    );
  }

  if (
    session &&
    (!d.me ||
      (d.me.status === "approved" &&
        !d.me.suspended &&
        !d.ready))
  ) {
    return (
      <View
        style={[
          s.page,
          {
            flex: 1,
            padding: 24,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <StatusBar style="dark" />

        <View
          style={{
            width: "100%",
            maxWidth: 420,
            alignItems: "center",
            gap: 16,
          }}
        >
          {!d.error && (
            <ActivityIndicator
              size="large"
              color="#047857"
            />
          )}

          <Text
            style={[
              s.h,
              {
                textAlign: "center",
                width: "100%",
              },
            ]}
          >
            {d.error
              ? "Unable to open your dashboard"
              : "Loading your dashboard…"}
          </Text>

          <Text
            style={[
              s.muted,
              {
                textAlign: "center",
                width: "100%",
              },
            ]}
          >
            {d.error ||
              "Preparing your account and attendance information."}
          </Text>

          {!!d.error && (
            <View
              style={{
                width: "100%",
                gap: 12,
              }}
            >
              <Button
                title="Retry"
                onPress={() => void d.reload()}
              />

              <Button
                title="Sign Out"
                secondary
                onPress={() => void signOut()}
              />
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="dark" />

      {!!d.error && session && (
        <View
          style={{
            backgroundColor: "#FFF1F2",
            padding: 12,
            gap: 6,
          }}
        >
          <Text style={s.error}>{d.error}</Text>

          <View style={s.row}>
            <Button
              title="Retry"
              secondary
              onPress={() => void d.reload()}
            />

            <Button
              title="Sign Out"
              secondary
              onPress={() => void signOut()}
            />
          </View>
        </View>
      )}

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: "#ECFDF5",
          },
        }}
      />
    </View>
  );
}

export default function Layout() {
  return (
    <AppDataProvider>
      <NoticeProvider>
        <Shell />
      </NoticeProvider>
    </AppDataProvider>
  );
}