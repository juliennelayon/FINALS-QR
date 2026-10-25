import { useEffect, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as XLSX from "xlsx-js-style";
import { useData } from "@/lib/AppData";
import {
  ScanEvent,
  monthKey,
  monthLabel,
  phDate,
  phase,
  rate,
} from "@/lib/domain";
import { buildCsv, csvFileName, exportCsv } from "@/lib/exportCsv";
import { excelFileName, exportExcel } from "@/lib/exportExcel";
import {
  Badge,
  Button,
  Chips,
  Empty,
  Field,
  Page,
  s,
  Sheet,
  Stat,
  Txt,
} from "@/components/Kit";
import { useNotice } from "@/components/Notice";
export function studentRows(d: any, eid: string) {
  const e = d.events.find((e: any) => e.id === eid);
  if (!e) return [];
  return d.event_audience
    .filter((a: any) => a.event_id === eid)
    .map((a: any) => {
      const p = d.profiles.find((p: any) => p.id === a.student_id),
        sp = d.student_profiles.find((p: any) => p.user_id === a.student_id),
        record = d.attendance.find(
          (r: any) => r.event_id === eid && r.student_id === a.student_id,
        );
      return {
        ...record,
        event_id: eid,
        student_id: a.student_id,
        name: p?.full_name || "Student",
        student_id_no: sp?.student_id_no || "",
        course: sp?.course || "",
        course_year: sp?.course_year || "",
        block: sp?.block || "",
        status: record?.status || "not yet recorded",
      };
    });
}
export function Breakdown({ rows }: { rows: any[] }) {
  const [open, setOpen] = useState(false);
  const keys = [
    ...new Set<string>(
      rows.map((r) =>
        [r.course, r.course_year, `Block ${r.block}`].join(" · "),
      ),
    ),
  ];
  return (
    <View style={s.card}>
      <Button
        title={
          open
            ? "Hide Course / Year / Block Breakdown"
            : "Show Course / Year / Block Breakdown"
        }
        secondary
        onPress={() => setOpen(!open)}
      />
      {open &&
        keys.map((key) => {
          const group = rows.filter(
            (r) =>
              [r.course, r.course_year, `Block ${r.block}`].join(" · ") === key,
          );
          return (
            <View key={key} style={{ gap: 6 }}>
              <Text style={s.label}>{key}</Text>
              <Txt muted>
                {group.length} assigned · Present{" "}
                {group.filter((r) => r.status === "present").length} · Late{" "}
                {group.filter((r) => r.status === "late").length} · Absent{" "}
                {group.filter((r) => r.status === "absent").length} · Not
                recorded{" "}
                {group.filter((r) => r.status === "not yet recorded").length}
              </Txt>
            </View>
          );
        })}
    </View>
  );
}
