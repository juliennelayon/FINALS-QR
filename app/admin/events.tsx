import { useEffect, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useData } from "@/lib/AppData";
import { phase, type ScanEvent } from "@/lib/domain";
import {
  Button,
  Chips,
  Empty,
  Field,
  Page,
  s,
} from "@/components/Kit";
import {
  EventCard,
  EventDetails,
  EventEditor,
} from "@/components/EventViews";

export default function Events() {
  const d = useData();
  const params = useLocalSearchParams();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [type, setType] = useState("All");
  const [selected, setSelected] = useState<ScanEvent | null>(null);
  const [create, setCreate] = useState(false);

  const manager = d.me?.role !== "student";
  const overview = String(params.overview || "");
  const eventId = String(params.event || "");

  useFocusEffect(
    useCallback(() => {
      if (overview !== "all" && overview !== "open") return;

      setFilter(overview === "open" ? "Ongoing" : "All");
      setSearch("");
      setType("All");
      setSelected(null);
      setCreate(false);
    }, [overview]),
  );

  useEffect(() => {
    if (!eventId) return;

    const event = d.events.find((item) => item.id === eventId);
    if (event) setSelected(event);
  }, [eventId, d.events]);

  const events = d.events
    .filter((event) => {
      const eventPhase = phase(event, d.now);

      const matchesOwner =
        d.me?.role !== "teacher" || event.created_by === d.me.id;

      const matchesArchive =
        filter === "Archived" ? event.archived : !event.archived;

      const matchesPhase =
        filter === "All" ||
        filter === "Archived" ||
        (filter === "Closed/Ended"
          ? ["Closed", "Ended"].includes(eventPhase)
          : eventPhase === filter);

      const matchesType =
        type === "All" ||
        (type === "Required" && event.required) ||
        (type === "Optional" && !event.required) ||
        (type === "Saved" &&
          d.saved_events.some((saved) => saved.event_id === event.id));

      const matchesSearch = `${event.title} ${event.event_code}`
        .toLowerCase()
        .includes(search.toLowerCase());

      return (
        matchesOwner &&
        matchesArchive &&
        matchesPhase &&
        matchesType &&
        matchesSearch
      );
    })
    .sort(
      (a, b) =>
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
          <Button
            title="Create Event"
            onPress={() => setCreate(true)}
          />
        ) : undefined
      }
    >
      <Field
        label="Search events"
        value={search}
        onChangeText={setSearch}
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
        onChange={setFilter}
      />

      <Chips
        items={
          manager
            ? ["All", "Required", "Optional"]
            : ["All", "Required", "Optional", "Saved"]
        }
        value={type}
        onChange={setType}
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
        {events.map((event) => (
          <View
            key={event.id}
            style={{ flexBasis: 320, flexGrow: 1 }}
          >
            <EventCard
              event={event}
              onPress={() => setSelected(event)}
            />
          </View>
        ))}
      </View>

      <EventDetails
        event={selected}
        onClose={() => setSelected(null)}
      />

      {create && (
        <EventEditor onClose={() => setCreate(false)} />
      )}
    </Page>
  );
}