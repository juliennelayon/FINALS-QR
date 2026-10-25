import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import { useData } from "@/lib/AppData";
import {
  audience,
  parsePH,
  phDate,
  phInput,
  phase,
  remaining,
  ScanEvent,
} from "@/lib/domain";
import {
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
import { EventCard, EventDetails, EventEditor } from "@/components/EventViews";
export default function Events() {
  const d = useData(),
    params = useLocalSearchParams(),
    [search, S] = useState(""),
    [filter, F] = useState("All"),
    [type, T] = useState("All"),
    [selected, E] = useState<ScanEvent | null>(null),
    [create, C] = useState(false);
  const manager = d.me?.role !== "student";
  useEffect(() => {
    if (params.event) {
      const e = d.events.find((x: any) => x.id === params.event);
      if (e) E(e);
    }
  }, [params.event, d.events.length]);
  const events = d.events
    .filter(
      (e: ScanEvent) =>
        (d.me?.role !== "teacher" || e.created_by === d.me.id) &&
        (filter === "Archived" ? e.archived : !e.archived) &&
        (filter === "All" ||
          filter === "Archived" ||
          (filter === "Closed/Ended"
            ? ["Closed", "Ended"].includes(phase(e, d.now))
            : phase(e, d.now) === filter)) &&
        (type === "All" ||
          (type === "Required" && e.required) ||
          (type === "Optional" && !e.required) ||
          (type === "Saved" &&
            d.saved_events.some((a: any) => a.event_id === e.id))) &&
        `${e.title} ${e.event_code}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort(
      (a: ScanEvent, b: ScanEvent) =>
        Date.parse(b.start_time || b.created_at) -
        Date.parse(a.start_time || a.created_at),
    );
  return (
    <Page
      title={
        d.me?.role === "administrator"
          ? "All Events"
          : manager
            ? "My Events"
            : "Events"
      }
      subtitle="School activities · Philippine Time"
      onRefresh={d.reload}
      refreshing={d.loading}
      actions={
        manager ? (
          <Button title="Create Event" onPress={() => C(true)} />
        ) : undefined
      }
    >
      <Field
        label="Search events"
        value={search}
        onChangeText={S}
        placeholder="Event name or code"
      />
      <Chips
        items={
          manager
            ? [
                "All",
                "Draft",
                "Upcoming",
                "Ongoing",
                "Closed/Ended",
                "Cancelled",
                "Archived",
              ]
            : ["All", "Upcoming", "Ongoing", "Closed/Ended", "Cancelled"]
        }
        value={filter}
        onChange={F}
      />
      <Chips
        items={
          manager
            ? ["All", "Required", "Optional"]
            : ["All", "Required", "Optional", "Saved"]
        }
        value={type}
        onChange={T}
      />
      {!events.length && (
        <Empty
          title="No matching events"
          body={
            manager
              ? "Create an event or choose another filter."
              : "Events appear when your completed profile is included in the published audience."
          }
        />
      )}
      <View style={s.grid}>
        {events.map((e: ScanEvent) => (
          <View key={e.id} style={{ flexBasis: 320, flexGrow: 1 }}>
            <EventCard event={e} onPress={() => E(e)} />
          </View>
        ))}
      </View>
      <EventDetails event={selected} onClose={() => E(null)} />
      {create && <EventEditor onClose={() => C(false)} />}
    </Page>
  );
}
