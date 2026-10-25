import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { Pressable, Text, View } from "react-native";
import {
  router,
  useLocalSearchParams,
} from "expo-router";

import { useData } from "@/lib/AppData";
import { phDate, phase } from "@/lib/domain";
import {
  Badge,
  Button,
  Chips,
  Empty,
  Field,
  Sheet,
  Stat,
  Txt,
  s,
} from "@/components/Kit";
import { useNotice } from "@/components/Notice";
import {
  allowedEvents,
  emptyFilters,
  filterRows,
  phDay,
  reportRows,
  selectEvents,
  topAttendees,
  totals,
  validateDates,
  type Filters,
  type ReportRow,
} from "@/lib/reporting";
import { exportReport } from "@/lib/reportExport";

export default function ReportsContent() {
  const d = useData();
  const notice = useNotice();
  const params = useLocalSearchParams();

  const student = d.me?.role === "student";

  const [tab, setTab] = useState("Attendance Reports");
  const [scope, setScope] = useState("Filtered Results");
  const [school, setSchool] = useState("");

  const [filters, setFilters] = useState<Filters>({
    ...emptyFilters,
    event: String(params.event || ""),
  });

  const [busy, setBusy] = useState(false);
  const [selected, setSelected] =
    useState<ReportRow | null>(null);
  const [limit, setLimit] = useState(30);

  const rankingMode =
    !student && tab === "Top Attendees";

  const all = scope === "All Eligible Records";

  function set(key: keyof Filters, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  useEffect(() => {
    if (params.event) {
      set("event", String(params.event));
    }
  }, [params.event]);

  useEffect(() => {
    setLimit(30);
  }, [filters, scope, tab]);

  let dateError = "";

  try {
    validateDates(filters);
  } catch (error) {
    dateError =
      error instanceof Error
        ? error.message
        : "Invalid dates";
  }

  const events = useMemo(
    () =>
      dateError
        ? []
        : selectEvents(d, filters, rankingMode),
    [
      d.events,
      d.event_audience,
      d.attendance,
      d.me,
      d.now,
      filters,
      rankingMode,
      dateError,
    ],
  );

  const rows = useMemo(
    () =>
      filterRows(
        reportRows(d, events),
        filters,
        all,
        rankingMode,
      ),
    [
      d.profiles,
      d.student_profiles,
      d.attendance,
      d.event_audience,
      d.me,
      events,
      filters,
      all,
      rankingMode,
    ],
  );

  const summary = totals(rows);
  const ranking = topAttendees(rows);
  const eventOptions = allowedEvents(d);
  const cfg = d.system_settings[0];

  const months = [
    ...new Set(
      eventOptions.map((event) =>
        phDay(
          event.start_time || event.created_at,
        ).slice(0, 7),
      ),
    ),
  ]
    .sort()
    .reverse();

  const filtersText = [
    scope,
    `Event: ${
      eventOptions.find(
        (event) => event.id === filters.event,
      )?.title || "All permitted events"
    }`,
    `Organizer: ${
      d.profiles.find(
        (profile) => profile.id === filters.organizer,
      )?.full_name || "All"
    }`,
    `Month: ${filters.month || "All"}`,
    `Dates: ${filters.from || "Any"} to ${filters.to || "Any"}`,
    all
      ? "All permitted students and statuses"
      : `Course: ${filters.course || "All"}; Year: ${filters.year || "All"}; Block: ${filters.block || "All"}; Search: ${filters.search || "None"}`,
    rankingMode
      ? "Ranking: completed required events; all attendance statuses; Top 10 ranks including ties"
      : `Status: ${all ? "All" : filters.status || "All"}`,
  ].join(" | ");

  async function download() {
    if (busy) return;

    validateDates(filters);

    if (!rows.length) {
      throw new Error(
        "No matching attendance entries to export.",
      );
    }

    const requiredData = [
      "profiles",
      "student_profiles",
      "events",
      "attendance",
      "event_audience",
    ] as const;

    if (requiredData.some((key) => d.errors[key])) {
      throw new Error(
        "Some report data could not load. Refresh successfully before exporting.",
      );
    }

    setBusy(true);

    try {
      await exportReport({
        rows,
        events,
        ranking,
        isRanking: rankingMode,
        school,
        filters: filtersText,
        exportedBy:
          d.me?.full_name || d.me?.email || "User",
        profiles: d.profiles,
      });
    } finally {
      setBusy(false);
    }
  }

  const monthly = [
    ...new Set(
      rows
        .filter((row) => row.scanned)
        .map((row) => phDay(row.scanned!).slice(0, 7)),
    ),
  ]
    .sort()
    .reverse();

  return (
    <>
      {!student && (
        <Chips
          items={["Attendance Reports", "Top Attendees"]}
          value={tab}
          onChange={setTab}
        />
      )}

      <Field
        label="School name for Excel header"
        value={school}
        onChangeText={setSchool}
        placeholder="Enter school / institution name"
      />

      <Text style={s.label}>Event</Text>

      <View style={s.row}>
        <Button
          title="All Events"
          secondary
          onPress={() => set("event", "")}
        />

        {eventOptions.map((event) => (
          <Pressable
            key={event.id}
            onPress={() => set("event", event.id)}
            style={[
              s.chip,
              filters.event === event.id && s.chipOn,
            ]}
          >
            <Txt>{event.title}</Txt>
          </Pressable>
        ))}
      </View>

      {d.me?.role === "administrator" && (
        <>
          <Text style={s.label}>Organizer</Text>

          <View style={s.row}>
            <Button
              title="All Organizers"
              secondary
              onPress={() => set("organizer", "")}
            />

            {d.profiles
              .filter(
                (profile) => profile.role !== "student",
              )
              .map((profile) => (
                <Pressable
                  key={profile.id}
                  onPress={() =>
                    set("organizer", profile.id)
                  }
                  style={[
                    s.chip,
                    filters.organizer === profile.id &&
                      s.chipOn,
                  ]}
                >
                  <Txt>
                    {profile.full_name || profile.email}
                  </Txt>
                </Pressable>
              ))}
          </View>
        </>
      )}

      <Text style={s.label}>
        Event Month · Philippine Time
      </Text>

      <Chips
        items={["All Months", ...months]}
        value={filters.month || "All Months"}
        onChange={(value) =>
          set(
            "month",
            value === "All Months" ? "" : value,
          )
        }
      />

      <Field
        label="From event date · YYYY-MM-DD"
        value={filters.from}
        onChangeText={(value) => set("from", value)}
        placeholder="2026-10-01"
      />

      <Field
        label="To event date · YYYY-MM-DD"
        value={filters.to}
        onChangeText={(value) => set("to", value)}
        placeholder="2026-10-31"
      />

      {!!dateError && (
        <Text style={s.error}>{dateError}</Text>
      )}

      <Text style={s.label}>Report / Export Scope</Text>

      <Chips
        items={[
          "Filtered Results",
          "All Eligible Records",
        ]}
        value={scope}
        onChange={setScope}
      />

      <Txt muted>
        All Eligible Records keeps the event, organizer and
        date selection, but clears student/status restrictions.
        Access remains limited to your account permissions.
      </Txt>

      {!all && (
        <>
          {!student && (
            <>
              <Chips
                items={[
                  "All Courses",
                  ...new Set([
                    ...(cfg?.courses || []),
                    ...rows.map((row) => row.course),
                  ]),
                ]}
                value={filters.course || "All Courses"}
                onChange={(value) =>
                  set(
                    "course",
                    value === "All Courses" ? "" : value,
                  )
                }
              />

              <Chips
                items={[
                  "All Years",
                  ...(cfg?.years || []),
                ]}
                value={filters.year || "All Years"}
                onChange={(value) =>
                  set(
                    "year",
                    value === "All Years" ? "" : value,
                  )
                }
              />

              <Chips
                items={[
                  "All Blocks",
                  ...(cfg?.blocks || []),
                ]}
                value={filters.block || "All Blocks"}
                onChange={(value) =>
                  set(
                    "block",
                    value === "All Blocks" ? "" : value,
                  )
                }
              />

              <Field
                label="Search student"
                value={filters.search}
                onChangeText={(value) =>
                  set("search", value)
                }
                placeholder="Name or student ID"
              />
            </>
          )}

          {!rankingMode && (
            <Chips
              items={[
                "All Statuses",
                "present",
                "late",
                "absent",
                "not yet recorded",
              ]}
              value={filters.status || "All Statuses"}
              onChange={(value) =>
                set(
                  "status",
                  value === "All Statuses" ? "" : value,
                )
              }
            />
          )}
        </>
      )}

      <Button
        title="Reset Filters"
        secondary
        onPress={() => {
          setFilters({ ...emptyFilters });
          setScope("Filtered Results");
        }}
      />

      <View style={s.grid}>
        <Stat
          label="Expected Entries"
          value={summary.expected}
        />
        <Stat
          label="Unique Students"
          value={summary.students}
        />
        <Stat label="Present" value={summary.present} />
        <Stat label="Late" value={summary.late} />
        <Stat label="Absent" value={summary.absent} />
        <Stat
          label="Not Yet Recorded"
          value={summary.unrecorded}
        />
        <Stat
          label="Attendance Rate"
          value={
            summary.rate === null
              ? "N/A"
              : `${(summary.rate * 100).toFixed(1)}%`
          }
        />
      </View>

      <Txt muted>
        Expected Entries counts one eligible student per event.
        Totals follow the displayed/exported rows. Missing
        records stay Not Yet Recorded; no scan times are
        invented.
      </Txt>

      <Button
        title={
          busy
            ? "Preparing Excel…"
            : rankingMode
              ? "Export Top Attendees · Excel"
              : "Export Attendance · Excel"
        }
        disabled={
          busy ||
          !!dateError ||
          !rows.length ||
          d.loading
        }
        onPress={() => notice.run(download)}
      />

      {rankingMode ? (
        <>
          <Text style={s.h}>Top Attendees</Text>

          <Txt muted>
            Completed required events only. Ranked by rate,
            then attended events, then fewer Late. Equal
            results share a rank. Ties at rank 10 are included.
          </Txt>

          {!ranking.length && (
            <Empty
              title="No eligible ranking records"
              body="Choose completed required events with eligible students."
            />
          )}

          {ranking.map((item) => (
            <View key={item.studentId} style={s.card}>
              <Text style={s.h}>
                #{item.rank} · {item.name}
              </Text>

              <Txt muted>
                {item.schoolId} · {item.course} · {item.year}
                {" · "}Block {item.block}
              </Txt>

              <Txt>
                Present {item.present} · Late {item.late}
                {" · "}Absent {item.absent}
              </Txt>

              <Txt>
                Not Recorded {item.unrecorded}
                {" · "}Eligible Events {item.expected}
              </Txt>

              <Text style={s.link}>
                {(item.rate * 100).toFixed(1)}% attendance
              </Text>
            </View>
          ))}
        </>
      ) : (
        <>
          {events.map((event) => (
            <View key={event.id} style={s.card}>
              <Text style={s.h}>{event.title}</Text>

              <Txt>{event.description || "—"}</Txt>

              <Txt muted>
                {event.event_code} · {event.venue}
                {" · "}{phase(event, d.now)}
              </Txt>

              <Txt muted>
                {phDate(event.start_time)}
                {" → "}
                {phDate(event.end_time)}
              </Txt>

              <Txt muted>
                Organizer:{" "}
                {d.profiles.find(
                  (profile) =>
                    profile.id === event.created_by,
                )?.full_name || "School organizer"}
              </Txt>

              {!student && (
                <Button
                  title="Open Event Attendance"
                  secondary
                  onPress={() =>
                    router.push({
                      pathname:
                        d.me?.role === "administrator"
                          ? "/admin/attendance"
                          : "/(tabs)/history",
                      params: { event: event.id },
                    })
                  }
                />
              )}
            </View>
          ))}

          {!rows.length && (
            <Empty title="No matching attendance entries" />
          )}

          {rows.slice(0, limit).map((row) => (
            <Pressable
              key={`${row.event.id}:${row.studentId}`}
              style={s.card}
              onPress={() => setSelected(row)}
            >
              <View style={s.row}>
                <Text style={s.h}>{row.name}</Text>
                <Badge value={row.status} />
              </View>

              <Txt>{row.event.title}</Txt>

              <Txt muted>
                {row.schoolId} · {row.course}
                {" · "}{row.year} · {row.block}
              </Txt>

              <Txt muted>
                {row.scanned
                  ? phDate(row.scanned)
                  : "No attendance time recorded"}
              </Txt>
            </Pressable>
          ))}

          {limit < rows.length && (
            <Button
              title={`Show More · ${rows.length - limit} remaining`}
              secondary
              onPress={() =>
                setLimit((current) => current + 30)
              }
            />
          )}

          <Text style={s.h}>Monthly Check-ins</Text>

          {monthly.map((month) => (
            <View key={month} style={s.card}>
              <Txt>
                {month} ·{" "}
                {
                  rows.filter(
                    (row) =>
                      row.scanned &&
                      phDay(row.scanned).startsWith(month),
                  ).length
                }{" "}
                check-ins
              </Txt>
            </View>
          ))}
        </>
      )}

      <Sheet
        title="Attendance Details"
        visible={!!selected}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <>
            <Text style={s.h}>{selected.name}</Text>
            <Txt>{selected.event.title}</Txt>
            <Badge value={selected.status} />

            <Txt>
              Scanned:{" "}
              {selected.scanned
                ? phDate(selected.scanned)
                : "—"}
            </Txt>

            <Txt>
              Reviewed:{" "}
              {selected.corrected
                ? phDate(selected.corrected)
                : "—"}
            </Txt>

            <Txt>
              Correction reason: {selected.reason || "—"}
            </Txt>

            {d.me?.role === "administrator" ? (
              <Button
                title="Open Attendance / Correction"
                onPress={() => {
                  setSelected(null);

                  router.push({
                    pathname: "/admin/attendance",
                    params: {
                      event: selected.event.id,
                    },
                  });
                }}
              />
            ) : (
              <Button
                title="Request Attendance Correction"
                onPress={() => {
                  setSelected(null);

                  router.push({
                    pathname: "/requests",
                    params: {
                      kind: "attendance",
                      event: selected.event.id,
                      student: selected.studentId,
                    },
                  });
                }}
              />
            )}
          </>
        )}
      </Sheet>
    </>
  );
}