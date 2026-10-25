import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";

import DateTimeField from "./DateTimeField";
import { generateEventCode } from "@/lib/eventCode";
import { useData } from "@/lib/AppData";
import {
  audience,
  eventDateTime,
  phDate,
  phInput,
  phase,
  remaining,
  type ScanEvent,
} from "@/lib/domain";
import {
  Badge,
  Button,
  Chips,
  Field,
  Sheet,
  Txt,
  s,
} from "@/components/Kit";
import { useNotice } from "@/components/Notice";

export function EventCard({
  event,
  onPress,
}: {
  event: ScanEvent;
  onPress: () => void;
}) {
  const d = useData();

  const saved = d.saved_events.some(
    (item) => item.event_id === event.id,
  );

  const attendance = d.attendance.find(
    (item) =>
      item.event_id === event.id &&
      item.student_id === d.me?.id,
  );

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        s.card,
        {
          borderLeftWidth: 4,
          borderLeftColor: "#10B981",
        },
      ]}
    >
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <Badge value={phase(event, d.now)} />
        {event.required && <Badge value="Required" />}
        {saved && <Badge value="Saved" />}
        {attendance && <Badge value={attendance.status} />}
      </View>

      <Text style={s.h}>{event.title}</Text>

      <Txt muted>
        {phDate(event.start_time)} · Philippine Time
      </Txt>

      <Txt>{event.venue || "Venue not set"}</Txt>

      <Text numberOfLines={2} style={s.muted}>
        {event.description}
      </Text>

      <Txt muted>{audience(event)}</Txt>

      {!!remaining(event, d.now) && (
        <Text style={s.link}>
          {remaining(event, d.now)}
        </Text>
      )}

      <Text style={s.link}>View details →</Text>
    </Pressable>
  );
}

export function EventDetails({
  event,
  onClose,
  initialFullScreen = false,
}: {
  event: ScanEvent | null;
  onClose: () => void;
  initialFullScreen?: boolean;
}) {
  const d = useData();
  const notice = useNotice();
  const dimensions = useWindowDimensions();

  const manager =
    d.me?.role === "teacher" ||
    d.me?.role === "administrator";

  const [showQr, setShowQr] = useState(
    initialFullScreen && manager,
  );
  const [editing, setEditing] = useState(false);
  const [fullScreen, setFullScreen] = useState(
    initialFullScreen && manager,
  );

  useEffect(() => {
    setShowQr(initialFullScreen && manager);
    setEditing(false);
    setFullScreen(initialFullScreen && manager);
  }, [event?.id, initialFullScreen, manager]);

  const me = d.me;

  if (!event || !me) return null;

  const current =
    d.events.find((item) => item.id === event.id) || event;

  const status = phase(current, d.now);

  const attendance = d.attendance.find(
    (item) =>
      item.event_id === current.id &&
      item.student_id === me.id,
  );

  const saved = d.saved_events.some(
    (item) => item.event_id === current.id,
  );

  const qrValue = JSON.stringify({
    v: 1,
    event: current.event_code,
  });

  const qrSize = Math.max(
    100,
    Math.min(
      dimensions.width - 104,
      dimensions.height - 220,
      480,
    ),
  );

  function runAction(operation: string) {
    notice.prompt(
      operation === "delete"
        ? "Delete draft?"
        : `${operation[0].toUpperCase() + operation.slice(1)} event`,
      operation === "cancel"
        ? "Explain why this event is cancelled."
        : "Enter a reason for this action.",
      async (reason: string) => {
        await d.act("scanin_manage_event", {
          eid: current.id,
          changes: {},
          operation,
          reason,
        });

        onClose();
      },
    );
  }

  return (
    <>
      <Sheet
        title="Event Details"
        visible={!editing && !fullScreen}
        onClose={onClose}
      >
        <View style={s.row}>
          <Badge value={status} />
          <Badge
            value={current.required ? "Required" : "Optional"}
          />
          {attendance && <Badge value={attendance.status} />}
        </View>

        <Text style={s.title}>{current.title}</Text>

        {[
          ["Event Code", current.event_code],
          ["Venue", current.venue],
          ["Description", current.description],
          ["Start", phDate(current.start_time)],
          ["End", phDate(current.end_time)],
          [
            "Organizer",
            d.profiles.find(
              (profile) => profile.id === current.created_by,
            )?.full_name || "School organizer",
          ],
          ["Audience", audience(current)],
          [
            "Late Allowance",
            `${current.late_minutes} minutes`,
          ],
        ].map(([label, value]) => (
          <View key={label}>
            <Text style={s.label}>{label}</Text>
            <Txt>{value || "—"}</Txt>
          </View>
        ))}

        <Txt muted>Times shown in Philippine Time.</Txt>

        {!!current.cancel_reason && (
          <Txt>
            Cancellation reason: {current.cancel_reason}
          </Txt>
        )}

        {manager ? (
          <>
            <Button
              title="Edit Event"
              secondary
              onPress={() => setEditing(true)}
            />

            <View style={s.row}>
              <Button
                title={showQr ? "Hide QR" : "Show QR"}
                secondary
                onPress={() => setShowQr(!showQr)}
              />

              <Button
                title="Copy Event Code"
                secondary
                onPress={() =>
                  notice.run(async () => {
                    await Clipboard.setStringAsync(
                      current.event_code,
                    );

                    notice.info("Event code copied.");
                  })
                }
              />
            </View>

            {showQr && (
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: "#FFFFFF",
                  borderRadius: 16,
                  padding: 16,
                  gap: 12,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open full-screen QR"
                  onPress={() => setFullScreen(true)}
                  style={{ padding: 8 }}
                >
                  <QRCode
                    size={Math.max(
                      100,
                      Math.min(dimensions.width - 112, 230),
                    )}
                    value={qrValue}
                    color="#000000"
                    backgroundColor="#FFFFFF"
                  />
                </Pressable>

                <Text style={s.h}>
                  {current.event_code}
                </Text>

                <Txt muted>Tap the QR to enlarge.</Txt>

                <Button
                  title="Full-screen QR"
                  secondary
                  onPress={() => setFullScreen(true)}
                />
              </View>
            )}

            <Button
              title="View Attendance"
              onPress={() => {
                onClose();

                router.push({
                  pathname:
                    me.role === "administrator"
                      ? "/admin/attendance"
                      : "/(tabs)/history",
                  params: { event: current.id },
                });
              }}
            />

            {current.status === "draft" && (
              <Button
                title="Publish Event"
                onPress={() =>
                  notice.run(async () => {
                    await d.act("scanin_manage_event", {
                      eid: current.id,
                      changes: {},
                      operation: "publish",
                    });

                    setShowQr(true);
                    setFullScreen(true);
                  })
                }
              />
            )}

            {current.status === "open" &&
              status !== "Ended" && (
                <Button
                  title="Close Event"
                  secondary
                  onPress={() => runAction("close")}
                />
              )}

            {current.status === "closed" &&
              status !== "Ended" && (
                <Button
                  title="Open Event"
                  secondary
                  onPress={() => runAction("reopen")}
                />
              )}

            {current.status !== "cancelled" && (
              <Button
                title="Cancel Event"
                danger
                onPress={() => runAction("cancel")}
              />
            )}

            {["Ended", "Cancelled"].includes(status) &&
              !current.archived && (
                <Button
                  title="Archive"
                  secondary
                  onPress={() => runAction("archive")}
                />
              )}

            {current.status === "draft" && (
              <Button
                title="Delete Draft"
                danger
                onPress={() => runAction("delete")}
              />
            )}
          </>
        ) : (
          <>
            <Button
              title={
                saved
                  ? "Unsave Event"
                  : "Save Event / Remind Me"
              }
              secondary
              onPress={() =>
                notice.run(() =>
                  d.act("scanin_save", {
                    eid: current.id,
                    save_event: !saved,
                  }),
                )
              }
            />

            {status === "Ongoing" && !attendance && (
              <View style={s.row}>
                <Button
                  title="Scan QR"
                  onPress={() => {
                    onClose();

                    router.push({
                      pathname: "/(tabs)/scan",
                      params: {
                        event: current.id,
                        mode: "qr",
                      },
                    });
                  }}
                />

                <Button
                  title="Enter Event Code"
                  secondary
                  onPress={() => {
                    onClose();

                    router.push({
                      pathname: "/(tabs)/scan",
                      params: {
                        event: current.id,
                        mode: "manual",
                      },
                    });
                  }}
                />
              </View>
            )}

            {!!attendance && (
              <Button
                title="View Attendance Record"
                onPress={() => {
                  onClose();

                  router.push({
                    pathname: "/(tabs)/history",
                    params: { event: current.id },
                  });
                }}
              />
            )}

            <Button
              title="Report Attendance Issue"
              secondary
              onPress={() => {
                onClose();

                router.push({
                  pathname: "/requests",
                  params: {
                    kind: "attendance",
                    event: current.id,
                    student: me.id,
                  },
                });
              }}
            />
          </>
        )}
      </Sheet>

      <Modal
        visible={fullScreen && manager}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setFullScreen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 24,
              padding: 20,
              alignItems: "center",
              gap: 18,
            }}
          >
            <QRCode
              size={qrSize}
              value={qrValue}
              color="#000000"
              backgroundColor="#FFFFFF"
            />

            <Text
              style={{
                fontSize: 19,
                fontWeight: "800",
                color: "#064E3B",
                textAlign: "center",
              }}
            >
              {current.event_code}
            </Text>

            <Button
              title="Close QR"
              secondary
              onPress={() => setFullScreen(false)}
            />
          </View>
        </View>
      </Modal>

      {editing && (
        <EventEditor
          event={current}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}

export function EventEditor({
  event,
  onClose,
}: {
  event?: ScanEvent;
  onClose: () => void;
}) {
  const d = useData();
  const notice = useNotice();
  const cfg = d.system_settings[0];

  const [eventCode, setEventCode] = useState(
    () => event?.event_code || generateEventCode(),
  );
  const [title, setTitle] = useState(event?.title || "");
  const [venue, setVenue] = useState(event?.venue || "");
  const [description, setDescription] = useState(
    event?.description || "",
  );

  const [start, setStart] = useState(
    phInput(
      event?.start_time ||
        new Date(d.now + 3600000).toISOString(),
    ),
  );

  const [end, setEnd] = useState(
    phInput(
      event?.end_time ||
        new Date(d.now + 7200000).toISOString(),
    ),
  );

  const [required, setRequired] = useState(
    event?.required ? "Required" : "Optional",
  );
  const [course, setCourse] = useState(
    event?.audience_course || "All Courses",
  );
  const [year, setYear] = useState(
    event?.audience_year || "All Years",
  );
  const [block, setBlock] = useState(
    event?.audience_block || "All Blocks",
  );
  const [late, setLate] = useState(
    String(event?.late_minutes ?? cfg?.late_minutes ?? 15),
  );

  const [busy, setBusy] = useState(false);
  const [createdEvent, setCreatedEvent] =
    useState<ScanEvent | null>(null);

  function changes() {
    if (
      !title.trim() ||
      !venue.trim() ||
      !description.trim()
    ) {
      throw new Error(
        "Event name, venue and description are required.",
      );
    }

    const startTime = eventDateTime(
      start,
      event?.start_time,
    );
    const endTime = eventDateTime(end, event?.end_time);

    if (Date.parse(endTime) <= Date.parse(startTime)) {
      throw new Error("End must be after start.");
    }

    if (!/^\d+$/.test(late) || Number(late) > 1440) {
      throw new Error(
        "Late allowance must be 0–1440 minutes.",
      );
    }

    return {
      event_code: event?.event_code || eventCode,
      title: title.trim(),
      venue: venue.trim(),
      description: description.trim(),
      start_time: startTime,
      end_time: endTime,
      required: required === "Required",
      audience_course:
        course === "All Courses" ? null : course,
      audience_year:
        year === "All Years" ? null : year,
      audience_block:
        block === "All Blocks" ? null : block,
      late_minutes: Number(late),
    };
  }

  async function save(operation: "save" | "publish") {
    if (busy) return;

    try {
      const proposed = changes();

      if (
        event &&
        d.me?.role === "administrator" &&
        operation === "save"
      ) {
        notice.prompt(
          "Review Event Changes",
          "Explain the reason for these changes. Existing recorded scan classifications are preserved.",
          async (reason: string) => {
            await d.act("scanin_manage_event", {
              eid: event.id,
              changes: proposed,
              operation: "admin_change",
              reason,
            });

            onClose();
          },
        );

        return;
      }

      setBusy(true);

      const eventId = await d.act<string>(
        "scanin_manage_event",
        {
          eid: event?.id || null,
          changes: proposed,
          operation,
        },
      );

      if (!event && operation === "publish") {
        setCreatedEvent({
          ...proposed,
          id: eventId,
          status: "open",
          created_by: d.me?.id || null,
          created_at: new Date(d.now).toISOString(),
          archived: false,
        });

        return;
      }

      onClose();
    } catch (error) {
      notice.info(
        error instanceof Error
          ? error.message
          : "Unable to save the event.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (createdEvent) {
    return (
      <EventDetails
        event={createdEvent}
        initialFullScreen
        onClose={onClose}
      />
    );
  }

  return (
    <Sheet
      title={event ? "Edit Event" : "Create Event"}
      visible
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <Field
        label="Event Code"
        value={event?.event_code || eventCode}
        editable={false}
      />

      {!event && (
        <Button
          title="Generate New Code"
          secondary
          disabled={busy}
          onPress={() => setEventCode(generateEventCode())}
        />
      )}

      <Txt muted>
        This code is used for QR and manual attendance.
        Saved event codes cannot be changed.
      </Txt>

      <Field
        label="Event Name"
        value={title}
        onChangeText={setTitle}
        editable={!busy}
      />

      <Field
        label="Venue"
        value={venue}
        onChangeText={setVenue}
        editable={!busy}
      />

      <Field
        label="Description"
        value={description}
        onChangeText={setDescription}
        editable={!busy}
        multiline
      />

      <DateTimeField
        label="Start Date & Time"
        value={start}
        onChange={setStart}
      />

      <DateTimeField
        label="End Date & Time"
        value={end}
        onChange={setEnd}
      />

      <Text style={s.label}>Attendance Type</Text>

      <Chips
        items={["Required", "Optional"]}
        value={required}
        onChange={setRequired}
      />

      <Text style={s.label}>Course</Text>

      <Chips
        items={["All Courses", ...(cfg?.courses || [])]}
        value={course}
        onChange={(value) => {
          setCourse(value);
          setYear("All Years");
          setBlock("All Blocks");
        }}
      />

      {course !== "All Courses" && (
        <>
          <Text style={s.label}>Year Level</Text>

          <Chips
            items={["All Years", ...(cfg?.years || [])]}
            value={year}
            onChange={(value) => {
              setYear(value);
              setBlock("All Blocks");
            }}
          />
        </>
      )}

      {year !== "All Years" && (
        <>
          <Text style={s.label}>Block</Text>

          <Chips
            items={["All Blocks", ...(cfg?.blocks || [])]}
            value={block}
            onChange={setBlock}
          />
        </>
      )}

      <Field
        label="Late Allowance (minutes)"
        value={late}
        onChangeText={setLate}
        keyboardType="number-pad"
        editable={!busy}
      />

      <Txt muted>
        Only eligible students matching the event audience
        can record attendance during the scheduled event.
      </Txt>

      {event && d.me?.role === "teacher" && (
        <Button
          title="Request Admin Review of Changes"
          secondary
          disabled={busy}
          onPress={() =>
            notice.run(async () => {
              const proposed = changes();

              onClose();

              router.push({
                pathname: "/requests",
                params: {
                  kind: "event",
                  event: event.id,
                  payload: JSON.stringify(proposed),
                },
              });
            })
          }
        />
      )}

      <Button
        title={
          busy
            ? "Saving…"
            : !event
              ? "Create Event"
              : event.status === "draft"
                ? "Publish Event"
                : "Save Changes"
        }
        disabled={busy}
        onPress={() =>
          void save(
            event && event.status !== "draft"
              ? "save"
              : "publish",
          )
        }
      />

      {(!event || event.status === "draft") && (
        <Button
          title="Save Draft"
          secondary
          disabled={busy}
          onPress={() => void save("save")}
        />
      )}
    </Sheet>
  );
}