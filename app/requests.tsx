import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Image,
  Linking,
  Text,
  View,
} from "react-native";
import {
  router,
  useLocalSearchParams,
} from "expo-router";

import { useData } from "@/lib/AppData";
import { uploadImage } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { phDate } from "@/lib/domain";
import { pickImage } from "@/lib/images";
import {
  parseProposal,
  proposalPreview,
} from "@/lib/requestPayload";
import { readField } from "@/lib/studentDetails";
import {
  requestLabel,
  visibleRequests,
} from "@/lib/inbox";
import type { CorrectionRequest } from "@/lib/types";
import {
  Badge,
  Button,
  Chips,
  Empty,
  Field,
  Page,
  Sheet,
  Txt,
  s,
} from "@/components/Kit";
import { useNotice } from "@/components/Notice";

type Kind = CorrectionRequest["kind"];
type Status = CorrectionRequest["status"];

function kindTitle(kind: Kind) {
  return kind === "profile"
    ? "Profile Correction"
    : kind === "event"
      ? "Event Change"
      : "Attendance Issue";
}

function pretty(value: unknown): string {
  if (value == null) return "All / none";

  return typeof value === "object"
    ? JSON.stringify(value)
    : String(value);
}

function validStatus(value: string): Status {
  return value === "resolved" || value === "declined"
    ? value
    : "pending";
}

export default function RequestsScreen() {
  const d = useData();
  const notice = useNotice();
  const params = useLocalSearchParams();

  const admin = d.me?.role === "administrator";
  const student = d.me?.role === "student";

  const [status, setStatus] =
    useState<Status>("pending");
  const [creating, setCreating] = useState(false);
  const [kind, setKind] = useState<Kind>("profile");
  const [eventId, setEventId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [field, setField] = useState("phone");
  const [value, setValue] = useState("");
  const [proposedStatus, setProposedStatus] =
    useState("present");
  const [payload, setPayload] = useState("{}");
  const [reason, setReason] = useState("");
  const [picture, setPicture] =
    useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);

  const submitLock = useRef(false);

  const own = visibleRequests(d.requests, d.me);

  const selected = own.find(
    (request) => request.id === selectedId,
  );

  useEffect(() => {
    if (params.status) {
      setStatus(validStatus(String(params.status)));
    }
  }, [params.status]);

  useEffect(() => {
    if (!params.request) return;

    setSelectedId(String(params.request));
    setCreating(false);
  }, [params.request]);

  useEffect(() => {
    if (selected) {
      setStatus(selected.status);
    }
  }, [selected?.id, selected?.status]);

  useEffect(() => {
    const type = String(params.kind || "");

    if (
      admin ||
      !["profile", "attendance", "event"].includes(type)
    ) {
      return;
    }

    setKind(type as Kind);
    setEventId(String(params.event || ""));
    setStudentId(
      String(params.student || d.me?.id || ""),
    );
    setPayload(String(params.payload || "{}"));
    setReason("");
    setValue("");
    setPicture(null);
    setSelectedId("");
    setCreating(true);
  }, [
    params.kind,
    params.event,
    params.student,
    params.payload,
    admin,
  ]);

  function closeDetails() {
    setSelectedId("");
    router.setParams({ request: undefined });
  }

  function closeForm() {
    if (busy) return;

    setCreating(false);

    router.setParams({
      kind: undefined,
      event: undefined,
      student: undefined,
      payload: undefined,
    });
  }

  const events = d.events.filter((event) =>
    student
      ? d.event_audience.some(
          (item) =>
            item.event_id === event.id &&
            item.student_id === d.me?.id,
        ) ||
        d.attendance.some(
          (item) =>
            item.event_id === event.id &&
            item.student_id === d.me?.id,
        )
      : event.created_by === d.me?.id,
  );

  async function submit() {
    if (submitLock.current) return;

    const account = d.me;

    if (!account || admin) {
      throw new Error(
        "Sign in with a student or teacher account to submit a request.",
      );
    }

    if (!reason.trim()) {
      throw new Error(
        "Explain the requested correction.",
      );
    }

    let changes;

    if (kind === "profile") {
      if (!student) {
        throw new Error(
          "Use the supported teacher request types.",
        );
      }

      if (!value.trim()) {
        throw new Error(
          "Enter the proposed corrected value.",
        );
      }

      changes = { [field]: value.trim() };
    } else {
      if (!events.some((event) => event.id === eventId)) {
        throw new Error(
          "Choose an event you can access.",
        );
      }

      if (kind === "attendance") {
        if (
          !student &&
          !d.event_audience.some(
            (item) =>
              item.event_id === eventId &&
              item.student_id === studentId,
          )
        ) {
          throw new Error(
            "Choose a student from this event’s audience.",
          );
        }

        changes = { status: proposedStatus };
      } else {
        if (student) {
          throw new Error(
            "Only an event organizer can request event changes.",
          );
        }

        changes = parseProposal(payload);

        if (!Object.keys(changes).length) {
          throw new Error(
            "Open My Events → Edit Event → Request Admin Review to propose changes.",
          );
        }
      }
    }

    submitLock.current = true;
    setBusy(true);

    try {
      const attachment = picture
        ? await uploadImage(
            picture,
            "attachment",
            account.id,
          )
        : null;

      await d.act("scanin_request", {
        kind_name: kind,
        eid: kind === "profile" ? null : eventId,
        sid:
          kind === "profile" || student
            ? account.id
            : kind === "event"
              ? null
              : studentId,
        proposed: changes,
        why: reason.trim(),
        file_path: attachment,
      });

      setCreating(false);
      setReason("");
      setPicture(null);
      setStatus("pending");

      router.setParams({
        kind: undefined,
        event: undefined,
        student: undefined,
        payload: undefined,
        status: "pending",
      });

      notice.info(
        "Request submitted. Your official record stays unchanged until administrator approval.",
      );
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  }

  function currentValue(
    request: CorrectionRequest,
    key: string,
  ) {
    if (request.kind === "event") {
      return readField(
        d.events.find(
          (event) => event.id === request.event_id,
        ),
        key,
      );
    }

    if (request.kind === "profile") {
      return key === "full_name"
        ? d.profiles.find(
            (profile) =>
              profile.id === request.student_id,
          )?.full_name
        : readField(
            d.student_profiles.find(
              (profile) =>
                profile.user_id === request.student_id,
            ),
            key,
          );
    }

    return readField(
      d.attendance.find(
        (record) =>
          record.event_id === request.event_id &&
          record.student_id === request.student_id,
      ),
      key,
    );
  }

  function review(approve: boolean) {
    if (
      !selected ||
      !admin ||
      selected.status !== "pending"
    ) {
      return;
    }

    const requestId = selected.id;

    notice.prompt(
      approve ? "Approve Request" : "Decline Request",
      "Enter the administrator response and review reason.",
      async (note: string) => {
        await d.act("scanin_resolve", {
          rid: requestId,
          approve,
          note,
        });

        closeDetails();
        setStatus(approve ? "resolved" : "declined");
      },
    );
  }

  const rows = own
    .filter((request) => request.status === status)
    .sort(
      (a, b) =>
        Date.parse(b.created_at) -
        Date.parse(a.created_at),
    );

  return (
    <Page
      back
      title={admin ? "Requests Center" : "My Requests"}
      subtitle="Corrections and administrator review history"
      onBack={() =>
        router.replace(
          admin ? "/admin/tools" : "/(tabs)/profile",
        )
      }
      onRefresh={d.reload}
      refreshing={d.loading}
    >
      {!admin && (
        <Button
          title="New Request"
          onPress={() => {
            setKind(student ? "profile" : "attendance");
            setEventId("");
            setStudentId(
              student ? d.me?.id || "" : "",
            );
            setPayload("{}");
            setReason("");
            setValue("");
            setPicture(null);
            setSelectedId("");
            setCreating(true);
          }}
        />
      )}

      <Txt muted>
        Pending{" "}
        {own.filter((r) => r.status === "pending").length}
        {" · "}Approved{" "}
        {own.filter((r) => r.status === "resolved").length}
        {" · "}Declined{" "}
        {own.filter((r) => r.status === "declined").length}
      </Txt>

      <Chips
        items={["Pending", "Approved", "Declined"]}
        value={requestLabel(status)}
        onChange={(next) =>
          setStatus(
            next === "Approved"
              ? "resolved"
              : next === "Declined"
                ? "declined"
                : "pending",
          )
        }
      />

      {!!d.errors.requests && (
        <View style={s.card}>
          <Text style={s.error}>
            Requests could not refresh. Please retry
            before reviewing.
          </Text>

          <Button
            title="Retry"
            secondary
            onPress={() => void d.reload()}
          />
        </View>
      )}

      {!rows.length &&
        !d.loading &&
        !d.errors.requests && (
          <Empty title="No requests in this category" />
        )}

      {rows.map((request) => (
        <View key={request.id} style={s.card}>
          <Badge value={requestLabel(request.status)} />

          <Text style={s.h}>
            {kindTitle(request.kind)}
          </Text>

          <Txt>{request.reason}</Txt>

          {admin && (
            <Txt muted>
              From:{" "}
              {d.profiles.find(
                (profile) =>
                  profile.id === request.requester_id,
              )?.full_name || "Account holder"}
            </Txt>
          )}

          <Txt muted>
            Submitted: {phDate(request.created_at)}
          </Txt>

          {!!request.reviewed_at && (
            <Txt muted>
              Reviewed: {phDate(request.reviewed_at)}
            </Txt>
          )}

          {!!request.response && (
            <Txt>Admin response: {request.response}</Txt>
          )}

          <Button
            title="View Request"
            secondary
            onPress={() => {
              setCreating(false);
              setSelectedId(request.id);
            }}
          />
        </View>
      ))}

      <Sheet
        title="Submit a Request"
        visible={creating && !admin}
        onClose={closeForm}
      >
        <Chips
          items={
            student
              ? ["profile", "attendance"]
              : ["attendance", "event"]
          }
          value={kind}
          onChange={(next) => setKind(next as Kind)}
        />

        {kind === "profile" ? (
          <>
            <Text style={s.label}>Field to Correct</Text>

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
              value={field}
              onChange={setField}
            />

            <Field
              label="Proposed Correct Value"
              value={value}
              onChangeText={setValue}
              editable={!busy}
            />

            <Txt muted>
              Use the official course, year and block
              spelling shown on your profile.
            </Txt>
          </>
        ) : (
          <>
            <Text style={s.label}>Event</Text>

            <View style={s.row}>
              {events.map((event) => (
                <Button
                  key={event.id}
                  title={`${eventId === event.id ? "✓ " : ""}${event.title}`}
                  secondary
                  disabled={busy}
                  onPress={() => {
                    setEventId(event.id);
                    setStudentId(
                      student ? d.me?.id || "" : "",
                    );
                  }}
                />
              ))}
            </View>

            {kind === "attendance" ? (
              <>
                {!student && (
                  <>
                    <Text style={s.label}>Student</Text>

                    <View style={s.row}>
                      {d.event_audience
                        .filter(
                          (item) =>
                            item.event_id === eventId,
                        )
                        .map((item) => (
                          <Button
                            key={item.student_id}
                            secondary
                            disabled={busy}
                            title={
                              (studentId === item.student_id
                                ? "✓ "
                                : "") +
                              (d.profiles.find(
                                (profile) =>
                                  profile.id ===
                                  item.student_id,
                              )?.full_name ||
                                item.student_id)
                            }
                            onPress={() =>
                              setStudentId(item.student_id)
                            }
                          />
                        ))}
                    </View>
                  </>
                )}

                <Text style={s.label}>
                  Requested Attendance Status
                </Text>

                <Chips
                  items={[
                    "present",
                    "late",
                    "absent",
                    "void",
                  ]}
                  value={proposedStatus}
                  onChange={setProposedStatus}
                />
              </>
            ) : (
              <>
                <Txt muted>
                  For event changes, open My Events →
                  Edit Event → Request Admin Review.
                </Txt>

                {Object.entries(
                  proposalPreview(payload),
                ).map(([key, next]) => (
                  <Txt key={key}>
                    {key.replaceAll("_", " ")}:{" "}
                    {pretty(next)}
                  </Txt>
                ))}
              </>
            )}
          </>
        )}

        <Field
          label="Reason / Explanation"
          value={reason}
          onChangeText={setReason}
          editable={!busy}
          multiline
        />

        <Button
          title={
            picture
              ? "Replace Screenshot"
              : "Attach Screenshot (optional)"
          }
          secondary
          disabled={busy}
          onPress={() =>
            notice.run(async () => {
              const uri = await pickImage(false);
              if (uri) setPicture(uri);
            })
          }
        />

        {!!picture && (
          <>
            <Image
              source={{ uri: picture }}
              style={{ height: 140, width: "100%" }}
              resizeMode="contain"
            />

            <Button
              title="Remove Screenshot"
              secondary
              disabled={busy}
              onPress={() => setPicture(null)}
            />
          </>
        )}

        <Button
          title={busy ? "Submitting…" : "Submit Request"}
          disabled={busy}
          onPress={() => notice.run(submit)}
        />
      </Sheet>

      <Sheet
        title="Request Details"
        visible={!!selectedId && !creating}
        onClose={closeDetails}
      >
        {selected ? (
          <>
            <Badge
              value={requestLabel(selected.status)}
            />

            <Text style={s.h}>
              {kindTitle(selected.kind)}
            </Text>

            <Txt>
              Requester:{" "}
              {d.profiles.find(
                (profile) =>
                  profile.id === selected.requester_id,
              )?.full_name || "Account holder"}
            </Txt>

            <Txt>
              Event:{" "}
              {d.events.find(
                (event) =>
                  event.id === selected.event_id,
              )?.title || "—"}
            </Txt>

            <Txt>
              Submitted: {phDate(selected.created_at)}
            </Txt>

            <Txt>Reason: {selected.reason}</Txt>

            <Text style={s.h}>Proposed Changes</Text>

            {Object.entries(
              selected.payload || {},
            ).map(([key, next]) => (
              <View key={key} style={s.card}>
                <Text style={s.label}>
                  {key.replaceAll("_", " ")}
                </Text>

                <Txt muted>
                  Current:{" "}
                  {pretty(currentValue(selected, key))}
                </Txt>

                <Txt>Proposed: {pretty(next)}</Txt>
              </View>
            ))}

            {!!selected.attachment && (
              <Button
                title="Open Supporting Screenshot"
                secondary
                onPress={() =>
                  notice.run(async () => {
                    const { data, error } =
                      await supabase.storage
                        .from("request-files")
                        .createSignedUrl(
                          selected.attachment!,
                          120,
                        );

                    if (error) throw error;

                    await Linking.openURL(
                      data.signedUrl,
                    );
                  })
                }
              />
            )}

            <Txt>
              Admin response:{" "}
              {selected.response || "Waiting for review"}
            </Txt>

            {!!selected.reviewed_at && (
              <Txt muted>
                Reviewed: {phDate(selected.reviewed_at)}
              </Txt>
            )}

            {admin &&
              selected.status === "pending" && (
                <>
                  <Txt muted>
                    Approval applies the proposed changes.
                    Review the details and affected records
                    before confirming.
                  </Txt>

                  <Button
                    title="Approve Request"
                    disabled={
                      !!d.errors.requests || d.loading
                    }
                    onPress={() => review(true)}
                  />

                  <Button
                    title="Decline Request"
                    danger
                    disabled={
                      !!d.errors.requests || d.loading
                    }
                    onPress={() => review(false)}
                  />
                </>
              )}
          </>
        ) : (
          <Txt>
            {d.loading
              ? "Loading request…"
              : "This request is unavailable or you do not have access. Refresh and try again."}
          </Txt>
        )}
      </Sheet>
    </Page>
  );
}