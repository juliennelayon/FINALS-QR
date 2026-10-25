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

export default function Users() {
  const d = useData(),
    notice = useNotice(),
    params = useLocalSearchParams(),
    [search, S] = useState(""),
    [role, R] = useState(String(params.role || "All Roles")),
    [status, F] = useState(String(params.status || "All Statuses")),
    [course, C] = useState("All Courses"),
    [year, Y] = useState("All Years"),
    [block, B] = useState("All Blocks"),
    [selected, A] = useState<any>(null),
    [detailField, DF] = useState("phone"),
    [detailValue, DV] = useState("");
  useEffect(() => {
    if (params.role) R(String(params.role));
    if (params.status) F(String(params.status));
  }, [params.role, params.status]);
  const rows = d.profiles.filter((p: any) => {
    const sp = d.student_profiles.find((x: any) => x.user_id === p.id);
    return (
      (role === "All Roles" || p.role === role) &&
      (status === "All Statuses" ||
        (status === "suspended"
          ? p.suspended
          : p.status === status && !p.suspended)) &&
      (course === "All Courses" || sp?.course === course) &&
      (year === "All Years" || sp?.course_year === year) &&
      (block === "All Blocks" || sp?.block === block) &&
      `${p.full_name} ${p.email} ${sp?.student_id_no}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  });
  return (
    <Page
      title="Manage Users"
      subtitle="Accounts, official details and access"
      refreshing={d.loading}
      onRefresh={d.reload}
    >
      <Field
        label="Search users"
        value={search}
        onChangeText={S}
        placeholder="Name, email or student ID"
      />
      <Chips
        items={["All Roles", "student", "teacher", "administrator"]}
        value={role}
        onChange={R}
      />
      <Chips
        items={["All Statuses", "approved", "pending", "rejected", "suspended"]}
        value={status}
        onChange={F}
      />
      <Chips
        items={["All Courses", ...(d.system_settings[0]?.courses || [])]}
        value={course}
        onChange={C}
      />
      <Chips
        items={["All Years", ...(d.system_settings[0]?.years || [])]}
        value={year}
        onChange={Y}
      />
      <Chips
        items={["All Blocks", ...(d.system_settings[0]?.blocks || [])]}
        value={block}
        onChange={B}
      />
      <Txt muted>{rows.length} matching accounts</Txt>
      {!rows.length && <Empty title="No matching users" />}
      {rows.map((p: any) => (
        <View key={p.id} style={s.card}>
          <View style={s.row}>
            <Avatar url={p.avatar_url} name={p.full_name} />
            <View style={{ flex: 1 }}>
              <Text style={s.h}>{p.full_name || "Unnamed account"}</Text>
              <Txt muted>{p.email}</Txt>
            </View>
          </View>
          <View style={s.row}>
            <Badge value={p.role} />
            {p.role === "teacher" && <Badge value={p.status} />}
            {p.suspended && <Badge value="Suspended" />}
          </View>
          <Button title="View Account" secondary onPress={() => A(p)} />
        </View>
      ))}
      <Sheet
        title="Account Details"
        visible={!!selected}
        onClose={() => A(null)}
      >
        {selected && (
          <>
            <Avatar
              url={selected.avatar_url}
              name={selected.full_name}
              size={70}
            />
            <Text style={s.h}>{selected.full_name}</Text>
            <Txt>{selected.email}</Txt>
            <Badge value={selected.role} />
            {selected.status_reason && (
              <Txt>Access note: {selected.status_reason}</Txt>
            )}
            {selected.role === "student" &&
              (() => {
                const sp = d.student_profiles.find(
                  (x: any) => x.user_id === selected.id,
                );
                return (
                  <>
                    {sp ? (
                      Object.entries(sp)
                        .filter(
                          ([k]) =>
                            !["created_at", "updated_at", "user_id"].includes(
                              k,
                            ),
                        )
                        .map(([k, v]) => (
                          <Txt key={k}>
                            {k}: {String(v ?? "—")}
                          </Txt>
                        ))
                    ) : (
                      <Txt>Student details incomplete.</Txt>
                    )}
                    <Text style={s.h}>Correct Student Details</Text>
                    <Chips
                      items={[
                        "full_name",
                        "student_id_no",
                        "course",
                        "course_year",
                        "block",
                        "gender",
                        "email",
                        "phone",
                      ]}
                      value={detailField}
                      onChange={DF}
                    />
                    <Field
                      label="Correct Value"
                      value={detailValue}
                      onChangeText={DV}
                    />
                    <Button
                      title="Apply Reviewed Correction"
                      secondary
                      onPress={() =>
                        notice.prompt(
                          "Correct Student Details",
                          "Enter the verified reason.",
                          async (why: string) => {
                            await d.act("scanin_admin_details", {
                              uid: selected.id,
                              changes: { [detailField]: detailValue },
                              why,
                            });
                            A(null);
                            DV("");
                          },
                        )
                      }
                    />
                    <Text style={s.h}>Attendance History</Text>
                    {d.attendance
                      .filter((a: any) => a.student_id === selected.id)
                      .map((a: any) => (
                        <View key={a.id} style={s.card}>
                          <Txt>
                            {
                              d.events.find((e: any) => e.id === a.event_id)
                                ?.title
                            }
                          </Txt>
                          <Badge value={a.status} />
                          <Txt muted>
                            {a.scanned_at
                              ? phDate(a.scanned_at)
                              : "No attendance time recorded"}
                          </Txt>
                        </View>
                      ))}
                  </>
                );
              })()}
            {selected.role === "teacher" && (
              <>
                <Text style={s.h}>Created Events</Text>
                {d.events
                  .filter((e: any) => e.created_by === selected.id)
                  .map((e: any) => (
                    <Button
                      title={e.title}
                      key={e.id}
                      secondary
                      onPress={() => {
                        A(null);
                        router.push({
                          pathname: "/admin/events",
                          params: { event: e.id },
                        });
                      }}
                    />
                  ))}
              </>
            )}
            {selected.role === "teacher" && selected.status === "pending" && (
              <View style={s.row}>
                <Button
                  title="Approve Teacher"
                  onPress={() => account("approved")}
                />
                <Button
                  title="Decline Teacher"
                  danger
                  onPress={() => account("rejected")}
                />
              </View>
            )}
            {selected.role !== "administrator" && (
              <Button
                title={
                  selected.suspended ? "Reactivate Account" : "Suspend Account"
                }
                danger={!selected.suspended}
                secondary={selected.suspended}
                onPress={() =>
                  account(selected.suspended ? "reactivate" : "suspend")
                }
              />
            )}
            <Txt muted>
              Roles cannot be changed here. Passwords are never shown.
            </Txt>
          </>
        )}
      </Sheet>
    </Page>
  );
  function account(action: string) {
    notice.prompt(
      "Account Action",
      "Enter the reason for this account decision.",
      async (why: string) => {
        await d.act("scanin_account", {
          uid: selected.id,
          new_status: action,
          why,
        });
        A(null);
      },
    );
  }
}
