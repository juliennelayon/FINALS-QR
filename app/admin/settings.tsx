import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useData } from "@/lib/AppData";
import { phDate } from "@/lib/domain";
import {
  Avatar,
  Badge,
  Button,
  Chips,
  Empty,
  Field,
  Page,
  s,
  Sheet,
  Txt,
} from "@/components/Kit";
import { useNotice } from "@/components/Notice";

export default function Settings() {
  const d = useData(),
    notice = useNotice(),
    cfg = d.system_settings[0],
    [late, L] = useState(String(cfg?.late_minutes || 15)),
    [start, S] = useState(String(cfg?.reminder_start_minutes || 30)),
    [end, E] = useState(String(cfg?.reminder_end_minutes || 10)),
    [courses, C] = useState((cfg?.courses || []).join(", ")),
    [years, Y] = useState((cfg?.years || []).join(", ")),
    [blocks, B] = useState((cfg?.blocks || []).join(", "));
  useEffect(() => {
    if (cfg) {
      L(String(cfg.late_minutes));
      S(String(cfg.reminder_start_minutes));
      E(String(cfg.reminder_end_minutes));
      C(cfg.courses.join(", "));
      Y(cfg.years.join(", "));
      B(cfg.blocks.join(", "));
    }
  }, [
    cfg?.late_minutes,
    cfg?.reminder_start_minutes,
    cfg?.reminder_end_minutes,
    JSON.stringify(cfg?.courses),
    JSON.stringify(cfg?.years),
    JSON.stringify(cfg?.blocks),
  ]);
  return (
    <Page back title="System Settings">
      <Txt muted>
        Defaults apply to new events. Existing event rules remain unchanged.
        Reminder timing applies to future reminders.
      </Txt>
      <Field
        label="Default Late Allowance (minutes)"
        value={late}
        onChangeText={L}
        keyboardType="number-pad"
      />
      <Field
        label="Start Reminder (minutes before)"
        value={start}
        onChangeText={S}
        keyboardType="number-pad"
      />
      <Field
        label="End Reminder (minutes before)"
        value={end}
        onChangeText={E}
        keyboardType="number-pad"
      />
      <Field
        label="Official Courses (comma-separated)"
        value={courses}
        onChangeText={C}
      />
      <Field
        label="Official Year Levels (comma-separated)"
        value={years}
        onChangeText={Y}
      />
      <Field
        label="Official Blocks (comma-separated)"
        value={blocks}
        onChangeText={B}
      />
      <Txt>Display timezone: Philippine Time (Asia/Manila)</Txt>
      <Button
        title="Review & Save Settings"
        onPress={() =>
          notice.run(async () => {
            if (
              !/^\d+$/.test(late) ||
              !/^\d+$/.test(start) ||
              !/^\d+$/.test(end)
            )
              throw Error("Timing values must be whole numbers.");
            notice.prompt(
              "Update System Defaults",
              "Explain this settings change.",
              async (why: string) => {
                await d.act("scanin_settings", {
                  changes: {
                    late_minutes: Number(late),
                    reminder_start_minutes: Number(start),
                    reminder_end_minutes: Number(end),
                    courses: courses
                      .split(",")
                      .map((x: string) => x.trim().toUpperCase())
                      .filter(Boolean),
                    years: years
                      .split(",")
                      .map((x: string) => x.trim().toUpperCase())
                      .filter(Boolean),
                    blocks: blocks
                      .split(",")
                      .map((x: string) => x.trim().toUpperCase())
                      .filter(Boolean),
                  },
                  why,
                });
                notice.info("System defaults updated.");
              },
            );
          })
        }
      />
    </Page>
  );
}
