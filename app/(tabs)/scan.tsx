import { isCompleteStudentDetails } from "@/lib/studentDetails";
import type { AttendanceResult } from "@/lib/types";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, Vibration, View } from "react-native";
import CameraPanel from "@/components/CameraPanel";
import { router, useLocalSearchParams } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useData } from "@/lib/AppData";
import { phDate } from "@/lib/domain";
import { Badge, Button, Chips, Field, Page, s, Txt } from "@/components/Kit";

export default function ScanScreen() {
  const d = useData(),
    params = useLocalSearchParams(),
    focus = useIsFocused(),
    [mode, M] = useState(
      params.mode === "manual" ? "Enter Event Code" : "Scan QR",
    ),
    [code, C] = useState(""),
    [busy, B] = useState(false),
    [result, R] = useState<AttendanceResult | null>(null),
    [error, X] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    M(params.mode === "manual" ? "Enter Event Code" : "Scan QR");
    R(null);
    X("");
    C("");
    lock.current = false;
  }, [params.mode, params.event]);
  const me = d.me,
    sp = d.student_profiles.find((p: any) => p.user_id === me?.id),
    complete = isCompleteStudentDetails(sp);
  async function submit(raw: string, method: string) {
    if (lock.current || !focus) return;
    lock.current = true;
    B(true);
    X("");
    try {
      let value = raw.trim();
      if (method === "qr") {
        let payload;
        try {
          payload = JSON.parse(raw);
        } catch {
          throw Error("Invalid attendance QR code.");
        }
        if (!payload || payload.v !== 1 || typeof payload.event !== "string")
          throw Error("Not a ScanIn attendance QR code.");
        value = payload.event;
      }
      if (!value)
        throw Error("Enter the event code provided by your organizer.");
      const data = await d.act<AttendanceResult>("scanin_record", {
        code: value,
        method,
        expected_event: params.event || null,
      });
      R(data);
      if (!data.duplicate) Vibration.vibrate(70);
    } catch (e: any) {
      X(e.message || "Unable to connect. Attendance has not been confirmed.");
    } finally {
      B(false);
      if (method === "manual") lock.current = false;
    }
  }
  return (
    <Page
      back={!!params.event}
      title="Record Attendance"
      subtitle="Scan the QR or enter the organizer’s event code"
    >
      {me?.role !== "student" ? (
        <Txt>Attendance recording is for students only.</Txt>
      ) : !complete ? (
        <View style={s.card}>
          <Text style={s.h}>Complete your student details first</Text>
          <Button
            title="Go to Profile"
            onPress={() => router.push("/(tabs)/profile")}
          />
        </View>
      ) : (
        <>
          <Chips
            items={["Scan QR", "Enter Event Code"]}
            value={mode}
            onChange={(v) => {
              M(v);
              R(null);
              X("");
              lock.current = false;
            }}
          />
          {params.event && (
            <Txt muted>
              Selected event:{" "}
              {d.events.find((e: any) => e.id === params.event)?.title ||
                "Event"}
            </Txt>
          )}
          {!result && mode === "Scan QR" && focus && (
            <CameraPanel
              disabled={busy || lock.current}
              onScan={(data) => void submit(data, "qr")}
            />
          )}
          {!result && mode === "Enter Event Code" && (
            <View style={s.card}>
              <Field
                label="Event Code"
                value={code}
                onChangeText={C}
                placeholder="SI-XXXXXXXXXX"
                autoCapitalize="characters"
                onSubmitEditing={() => void submit(code, "manual")}
                editable={!busy}
              />
              <Button
                title={busy ? "Submitting…" : "Submit Attendance"}
                disabled={busy || !code.trim()}
                onPress={() => void submit(code, "manual")}
              />
            </View>
          )}
          {busy && <ActivityIndicator color="#047857" />}
          {!!error && (
            <View style={s.card}>
              <Text style={s.error}>{error}</Text>
              <Button
                title="Try Again"
                onPress={() => {
                  lock.current = false;
                  X("");
                }}
              />
            </View>
          )}
          {result && (
            <View style={s.card}>
              <Badge
                value={result.duplicate ? "Already Recorded" : result.status}
              />
              <Text style={s.title}>
                {result.duplicate
                  ? "Attendance already recorded for this event."
                  : "Attendance recorded!"}
              </Text>
              <Txt>{result.title}</Txt>
              <Txt>{me.full_name}</Txt>
              <Txt>Status: {result.status}</Txt>
              <Txt>
                {result.scanned_at
                  ? `Recorded: ${phDate(result.scanned_at)}`
                  : "No attendance time recorded"}
              </Txt>
              <Button
                title="View Record"
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/history",
                    params: { event: result.event_id },
                  })
                }
              />
              <Button
                title="Scan Again"
                secondary
                onPress={() => {
                  R(null);
                  X("");
                  C("");
                  lock.current = false;
                }}
              />
            </View>
          )}
        </>
      )}
    </Page>
  );
}
