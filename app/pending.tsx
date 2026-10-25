import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";

import { useData } from "@/lib/AppData";
import { signOut, useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import {
  Badge,
  Button,
  Page,
  Txt,
  s,
} from "@/components/Kit";

export default function Pending() {
  const d = useData();
  const { user } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(d.me);
  const [checking, setChecking] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [lastChecked, setLastChecked] = useState("");

  const checkingRef = useRef(false);

  useEffect(() => {
    if (d.me) setProfile(d.me);
  }, [d.me]);

  async function checkStatus() {
    if (checkingRef.current || signingOut) return;

    const userId = user?.id || d.me?.id;

    if (!userId) {
      setError("Your session has expired. Please sign in again.");
      return;
    }

    checkingRef.current = true;
    setChecking(true);
    setMessage("");
    setError("");

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      15000,
    );

    try {
      const { data, error: queryError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .abortSignal(controller.signal)
        .single();

      if (queryError) {
        throw new Error(queryError.message);
      }

      if (!data) {
        throw new Error("Your account profile could not be found.");
      }

      const updatedProfile = data as Profile;

      setProfile(updatedProfile);

      setLastChecked(
        new Date().toLocaleTimeString("en-PH", {
          timeZone: "Asia/Manila",
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
        }),
      );

      if (updatedProfile.suspended) {
        setMessage(
          "Your account is suspended. Please contact the administrator.",
        );
      } else if (updatedProfile.status === "approved") {
        setMessage(
          "Your account is approved. Loading your dashboard…",
        );
      } else if (updatedProfile.status === "rejected") {
        setMessage(
          "Your teacher request was declined. Please contact the administrator.",
        );
      } else {
        setMessage(
          "Status checked. Your teacher account is still waiting for administrator approval.",
        );
      }

      // Refresh the shared account data.
      // The existing route guard opens the approved dashboard.
      void d.reload();
    } catch (caught) {
      setError(
        controller.signal.aborted
          ? "Checking took too long. Check your connection and try again."
          : caught instanceof Error
            ? caught.message
            : "Unable to check your account status.",
      );
    } finally {
      clearTimeout(timeout);
      checkingRef.current = false;
      setChecking(false);
    }
  }

  async function handleSignOut() {
    if (signingOut || checking) return;

    setSigningOut(true);
    setError("");

    try {
      const result = await signOut();

      if (result.error) {
        throw new Error(result.error);
      }

      router.replace("/login");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to sign out. Please try again.",
      );
    } finally {
      setSigningOut(false);
    }
  }

  const account = profile || d.me;

  const heading = account?.suspended
    ? "Your account access is restricted"
    : account?.status === "approved"
      ? "Your account is approved"
      : account?.status === "rejected"
        ? "Your teacher request was declined"
        : "Waiting for administrator approval";

  return (
    <Page title="Account Status">
      <View style={s.card}>
        <Badge
          value={
            account?.suspended
              ? "Suspended"
              : account?.status || "Loading"
          }
        />

        <Text style={s.h}>{heading}</Text>

        {!!account?.full_name && (
          <Txt>{account.full_name}</Txt>
        )}

        {!!account?.email && (
          <Txt muted>{account.email}</Txt>
        )}

        <Txt>
          {account?.status_reason ||
            "Teacher accounts require administrator approval before access."}
        </Txt>
      </View>

      {!!message && (
        <View style={s.card}>
          <Txt>{message}</Txt>

          {!!lastChecked && (
            <Txt muted>
              Last checked: {lastChecked} · Philippine Time
            </Txt>
          )}
        </View>
      )}

      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}

      <Button
        title={checking ? "Checking…" : "Check Status"}
        disabled={checking || signingOut}
        onPress={() => void checkStatus()}
      />

      <Button
        title={signingOut ? "Signing out…" : "Sign Out"}
        secondary
        disabled={checking || signingOut}
        onPress={() => void handleSignOut()}
      />
    </Page>
  );
}