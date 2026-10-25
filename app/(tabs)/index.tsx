import { isCompleteStudentDetails } from "@/lib/studentDetails";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useData } from "@/lib/AppData";
import { phase, phDate, rate, ScanEvent } from "@/lib/domain";
import { HomeInboxActions } from "@/components/InboxActions";
import {
  Avatar,
  Badge,
  Button,
  Empty,
  Page,
  s,
  Stat,
  Txt,
} from "@/components/Kit";
import { EventCard, EventDetails, EventEditor } from "@/components/EventViews";
import { studentRows } from "@/components/AttendanceViews";

export default function Dashboard() {
  const d = useData(),
    [selected, E] = useState<ScanEvent | null>(null),
    [create, C] = useState(false);
  const p = d.me;
  if (!p)
    return (
      <Page title="ScanIn">
        <Txt>Loading your account…</Txt>
      </Page>
    );
  const student = p.role === "student",
    admin = p.role === "administrator";
  const events = d.events.filter(
    (e: ScanEvent) =>
      !e.archived && (p.role !== "teacher" || e.created_by === p.id),
  );
  const today = phDate(new Date(d.now).toISOString(), false);
  const upcoming = events
    .filter((e: ScanEvent) => phase(e, d.now) === "Upcoming")
    .sort(
      (a: ScanEvent, b: ScanEvent) =>
        Date.parse(a.start_time!) - Date.parse(b.start_time!),
    );
  const active = events.filter((e: ScanEvent) => phase(e, d.now) === "Ongoing");
  const mine = d.attendance.filter(
    (a: any) => !student || a.student_id === p.id,
  );
  const recent = mine
    .filter((a: any) => a.scanned_at)
    .sort(
      (a: any, b: any) => Date.parse(b.scanned_at) - Date.parse(a.scanned_at),
    )
    .slice(0, 5);
  const sp = d.student_profiles.find((a: any) => a.user_id === p.id);
  const complete = isCompleteStudentDetails(sp);
  const percent = rate(
    d.attendance,
    events,
    d.event_audience,
    student ? p.id : undefined,
    d.now,
  );
  const notices = d.notifications.filter((n: any) => !n.read_at).length;
  function attendance(status?: string) {
    router.push({
      pathname: admin ? "/admin/attendance" : "/(tabs)/history",
      params: status ? { status } : {},
    } as any);
  }
  return (
    <Page
      title={`Hi, ${p.full_name?.split(" ")[0] || "there"}!`}
      subtitle={`${today} · Philippine Time`}
      onRefresh={d.reload}
      refreshing={d.loading}
     actions={<HomeInboxActions />}
    >
      <View style={s.row}>
        <Badge
          value={student ? "Student" : admin ? "Administrator" : "Teacher"}
        />
        <Badge
          value={
            d.live === "live"
              ? "Live"
              : d.live === "error"
                ? "Connection interrupted"
                : "Connecting"
          }
        />
        <Txt muted>Updated: {d.updated ? phDate(d.updated) : "Loading…"}</Txt>
      </View>
      {student && !complete && (
        <View style={s.card}>
          <Text style={s.h}>Complete your student details</Text>
          <Txt muted>
            Your completed profile is required before attendance and inclusion
            in new event rosters.
          </Txt>
          <Button
            title="Complete Profile"
            onPress={() => router.push("/(tabs)/profile")}
          />
        </View>
      )}
      <View style={s.grid}>
        {student ? (
          <>
            <Stat
              label="Total Attended"
              value={
                mine.filter((a: any) => ["present", "late"].includes(a.status))
                  .length
              }
              onPress={() => attendance()}
            />
            {["present", "late", "absent"].map((x) => (
              <Stat
                key={x}
                label={x}
                value={mine.filter((a: any) => a.status === x).length}
                onPress={() => attendance(x)}
              />
            ))}
          </>
        ) : (
          <>
            {admin ? (
              <>
                <Stat
                  label="Students"
                  value={
                    d.profiles.filter((p: any) => p.role === "student").length
                  }
                  onPress={() =>
                    router.push({
                      pathname: "/admin/users",
                      params: { role: "student" },
                    })
                  }
                />
                <Stat
                  label="Teachers"
                  value={
                    d.profiles.filter((p: any) => p.role === "teacher").length
                  }
                  onPress={() =>
                    router.push({
                      pathname: "/admin/users",
                      params: { role: "teacher" },
                    })
                  }
                />
              </>
            ) : null}
            <Stat
              label={admin ? "Events" : "My Events"}
              value={events.length}
              onPress={() =>
                router.push(admin ? "/admin/events" : "/(tabs)/teacher")
              }
            />
            <Stat
              label="Ongoing Events"
              value={active.length}
              onPress={() =>
                router.push(admin ? "/admin/events" : "/(tabs)/teacher")
              }
            />
            <Stat
              label="Today’s Check-ins"
              value={
                mine.filter(
                  (a: any) =>
                    a.scanned_at && phDate(a.scanned_at, false) === today,
                ).length
              }
              onPress={() => attendance()}
            />
          </>
        )}
      </View>
      <View style={s.card}>
        <Text style={s.h}>Required-event attendance rate</Text>
        <Txt>
          {percent === null
            ? "No completed required events yet."
            : `${percent}% · Present + Late / completed required assignments`}
        </Txt>
        {percent !== null && (
          <View
            style={{ height: 10, backgroundColor: "#D1FAE5", borderRadius: 8 }}
          >
            <View
              style={{
                height: 10,
                width: `${percent}%`,
                backgroundColor: "#047857",
                borderRadius: 8,
              }}
            />
          </View>
        )}
      </View>
      {student ? (
        <View style={s.row}>
          <Button
            title="Scan QR"
            icon="scan-outline"
            onPress={() =>
              router.push({ pathname: "/(tabs)/scan", params: { mode: "qr" } })
            }
          />
          <Button
            title="Enter Event Code"
            secondary
            onPress={() =>
              router.push({
                pathname: "/(tabs)/scan",
                params: { mode: "manual" },
              })
            }
          />
        </View>
      ) : (
        <View style={s.row}>
          <Button title="Create Event" icon="add" onPress={() => C(true)} />
          <Button
            title="View Attendance"
            secondary
            onPress={() => attendance()}
          />
          {admin && (
            <>
              <Button
                title="Manage Users"
                secondary
                onPress={() => router.push("/admin/users")}
              />
              <Button
                title="Reports"
                secondary
                onPress={() => router.push("/admin/reports")}
              />
            </>
          )}
        </View>
      )}
      {admin && (
        <View style={s.card}>
          <Text style={s.h}>Needs Attention</Text>
          <Button
            title={`Teacher Approvals (${d.profiles.filter((p: any) => p.role === "teacher" && p.status === "pending").length})`}
            secondary
            onPress={() =>
              router.push({
                pathname: "/admin/users",
                params: { status: "pending" },
              })
            }
          />
          <Button
            title={`Pending Requests (${d.requests.filter((r: any) => r.status === "pending").length})`}
            secondary
            onPress={() => router.push("/requests")}
          />
        </View>
      )}
      <Text style={s.h}>{student ? "Happening Now" : "Active Events"}</Text>
      {!active.length && <Empty title="No ongoing events" />}
      {active.map((e: ScanEvent) => (
        <View key={e.id} style={{ gap: 8 }}>
          <EventCard event={e} onPress={() => E(e)} />
          {!student && (
            <Txt>
              Live check-ins:{" "}
              {
                studentRows(d, e.id).filter((a: any) =>
                  ["present", "late"].includes(a.status),
                ).length
              }{" "}
              ·{" "}
              <Text
                style={s.link}
                onPress={() => {
                  E(e);
                }}
              >
                Show QR / View Code / Attendance
              </Text>
            </Txt>
          )}
        </View>
      ))}
      {!student && (
        <>
          <Text style={s.h}>Today’s Events</Text>
          {events
            .filter((e: ScanEvent) => phDate(e.start_time, false) === today)
            .map((e: ScanEvent) => (
              <EventCard key={e.id} event={e} onPress={() => E(e)} />
            ))}
        </>
      )}
      <Text style={s.h}>{student ? "Next Event" : "Upcoming Events"}</Text>
      {!upcoming.length ? (
        <Txt muted>No upcoming events.</Txt>
      ) : (
        upcoming
          .slice(0, student ? 1 : 3)
          .map((e: ScanEvent) => (
            <EventCard key={e.id} event={e} onPress={() => E(e)} />
          ))
      )}
      <Text style={s.h}>
        {student ? "Recent Attendance" : "Recent Check-ins"}
      </Text>
      {!recent.length && <Txt muted>No check-ins yet.</Txt>}
      {recent.slice(0, student ? 3 : 5).map((a: any) => (
        <Pressable
          key={a.id}
          style={s.card}
          onPress={() =>
            router.push({
              pathname: admin ? "/admin/attendance" : "/(tabs)/history",
              params: { event: a.event_id },
            } as any)
          }
        >
          <Text style={s.h}>
            {d.events.find((e: any) => e.id === a.event_id)?.title || "Event"}
          </Text>
          {!student && (
            <Txt>
              {d.profiles.find((p: any) => p.id === a.student_id)?.full_name ||
                "Student"}
            </Txt>
          )}
          <Badge value={a.status} />
          <Txt muted>{phDate(a.scanned_at)}</Txt>
        </Pressable>
      ))}
      <Button
        title="View All Attendance"
        secondary
        onPress={() => attendance()}
      />
      {admin && (
        <>
          <Text style={s.h}>Recent Activity</Text>
          {d.audit_log
            .slice()
            .reverse()
            .slice(0, 4)
            .map((a: any) => (
              <View style={s.card} key={a.id}>
                <Txt>
                  {a.action} · {a.record_type}
                </Txt>
                <Txt muted>
                  {a.reason} · {phDate(a.created_at)}
                </Txt>
              </View>
            ))}
        </>
      )}
      <EventDetails event={selected} onClose={() => E(null)} />
      {create && <EventEditor onClose={() => C(false)} />}
    </Page>
  );
}
