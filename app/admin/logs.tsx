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

export default function Audit() {
  const d = useData(),
    [search, S] = useState(""),
    [selected, A] = useState<any>(null);
  return (
    <Page
      back
      title="Activity Logs"
      subtitle="Read-only administrative audit trail"
      refreshing={d.loading}
      onRefresh={d.reload}
    >
      <Field
        label="Search logs"
        value={search}
        onChangeText={S}
        placeholder="Action, record or reason"
      />
      {d.audit_log
        .slice()
        .reverse()
        .filter((a: any) =>
          `${a.action} ${a.record_type} ${a.reason}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .map((a: any) => (
          <View key={a.id} style={s.card}>
            <Text style={s.h}>
              {a.action} · {a.record_type}
            </Text>
            <Txt muted>
              By{" "}
              {d.profiles.find((p: any) => p.id === a.actor_id)?.full_name ||
                "System"}{" "}
              · {phDate(a.created_at)}
            </Txt>
            <Txt>{a.reason || "System operation"}</Txt>
            <Button
              title="View Before / After"
              secondary
              onPress={() => A(a)}
            />
          </View>
        ))}
      <Sheet title="Audit Entry" visible={!!selected} onClose={() => A(null)}>
        {selected && (
          <>
            <Txt>Record: {selected.record_id}</Txt>
            <Text style={s.label}>Before</Text>
            <Txt>{JSON.stringify(selected.old_value, null, 2) || "—"}</Txt>
            <Text style={s.label}>After</Text>
            <Txt>{JSON.stringify(selected.new_value, null, 2) || "—"}</Txt>
          </>
        )}
      </Sheet>
    </Page>
  );
}
