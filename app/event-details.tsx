import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";

import { useData } from "@/lib/AppData";
import { phDate, phase } from "@/lib/domain";
import {
  Badge,
  Button,
  Empty,
  Page,
  Txt,
  s,
} from "@/components/Kit";
import { EventDetails } from "@/components/EventViews";

export default function EventDetailsPage() {
  const d = useData();
  const params = useLocalSearchParams();
  const eventId = String(params.event || "");

  const [open, setOpen] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setOpen(true);
    }, [eventId]),
  );

  const event = d.events.find(
    (item) => item.id === eventId,
  );

  const me = d.me;

  const canView =
    !!event &&
    !!me &&
    (me.role === "administrator" ||
      (me.role === "teacher" &&
        event.created_by === me.id) ||
      (me.role === "student" &&
        (d.event_audience.some(
          (item) =>
            item.event_id === event.id &&
            item.student_id === me.id,
        ) ||
          d.attendance.some(
            (item) =>
              item.event_id === event.id &&
              item.student_id === me.id,
          ))));

  return (
    <Page
      back
      title="Event Details"
      onBack={() => router.replace("/notifications")}
      onRefresh={d.reload}
      refreshing={d.loading}
    >
      {event && canView ? (
        <>
          <View style={s.card}>
            <Badge value={phase(event, d.now)} />

            <Text style={s.h}>{event.title}</Text>

            <Txt>Event Code: {event.event_code}</Txt>
            <Txt>Venue: {event.venue || "—"}</Txt>
            <Txt>{event.description || "—"}</Txt>

            <Txt muted>
              Start: {phDate(event.start_time)}
            </Txt>

            <Txt muted>
              End: {phDate(event.end_time)}
            </Txt>

            <Button
              title="Open Event Details"
              onPress={() => setOpen(true)}
            />
          </View>

          <EventDetails
            event={open ? event : null}
            onClose={() => setOpen(false)}
          />
        </>
      ) : d.loading ? (
        <Txt>Loading event details…</Txt>
      ) : (
        <>
          <Empty
            title="Event unavailable"
            body="The event could not be loaded or is no longer available to your account."
          />

          <Button
            title="Retry"
            secondary
            onPress={() => void d.reload()}
          />
        </>
      )}
    </Page>
  );
}