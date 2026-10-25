import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";

import ProfileHeader from "@/components/ProfileHeader";
import { RequestsButton } from "@/components/InboxActions";
import { useData } from "@/lib/AppData";
import { signOut } from "@/lib/auth";
import { disconnectPush } from "@/lib/notifications";
import { isCompleteStudentDetails } from "@/lib/studentDetails";
import {
  Badge,
  Button,
  Chips,
  Field,
  Page,
  Txt,
  s,
} from "@/components/Kit";
import { useNotice } from "@/components/Notice";

export default function ProfileScreen() {
  const d = useData();
  const notice = useNotice();
  const me = d.me;

  const studentInfo = d.student_profiles.find(
    (profile) => profile.user_id === me?.id,
  );

  const complete =
    isCompleteStudentDetails(studentInfo);

  if (!me) {
    return (
      <Page title="Profile">
        <Txt>Loading profile…</Txt>
      </Page>
    );
  }

  return (
    <Page
      back
      title="My Profile"
      onRefresh={d.reload}
      refreshing={d.loading}
    >
      <ProfileHeader />

      {me.role === "student" && (
        <>
          <Text style={s.h}>
            Official Student Details
          </Text>

          <Badge
            value={
              complete
                ? "Complete · Locked"
                : "Incomplete"
            }
          />

          {complete && studentInfo ? (
            <View style={s.card}>
              {[
                ["Student ID", studentInfo.student_id_no],
                ["Course", studentInfo.course],
                ["Year Level", studentInfo.course_year],
                ["Block", studentInfo.block],
                ["Gender", studentInfo.gender],
                ["Email", studentInfo.email],
                ["Phone", studentInfo.phone],
                ["Age", studentInfo.age ?? "—"],
              ].map(([label, value]) => (
                <View key={String(label)}>
                  <Text style={s.label}>{label}</Text>
                  <Txt>{value}</Txt>
                </View>
              ))}

              <Txt muted>
                Official details are locked. Your profile
                picture can still be updated.
              </Txt>

              <Button
                title="Request Correction"
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/requests",
                    params: {
                      kind: "profile",
                      student: me.id,
                    },
                  })
                }
              />
            </View>
          ) : (
            <StudentForm />
          )}
        </>
      )}

      <RequestsButton />

      <Button
        title="Sign Out"
        danger
        onPress={() =>
          notice.run(async () => {
            try {
              await disconnectPush();
            } catch {
              // Continue signing out if push cleanup fails.
            }

            const result = await signOut();

            if (result.error) {
              throw new Error(result.error);
            }

            router.replace("/login");
          })
        }
      />
    </Page>
  );
}

function StudentForm() {
  const d = useData();
  const notice = useNotice();
  const me = d.me;
  const cfg = d.system_settings[0];

  const student = d.student_profiles.find(
    (profile) => profile.user_id === me?.id,
  );

  const [form, setForm] =
    useState<Record<string, string>>({
      student_id_no: student?.student_id_no || "",
      course: student?.course || "",
      course_year: student?.course_year || "",
      block: student?.block || "",
      gender: student?.gender || "",
      age: student?.age?.toString() || "",
      email: student?.email || me?.email || "",
      phone: student?.phone || "",
    });

  const [busy, setBusy] = useState(false);

  function updateField(key: string, value: string) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function submit() {
    if (busy) return;

    const userId = me?.id;

    if (!userId) {
      throw new Error(
        "Sign in again before saving your details.",
      );
    }

    for (const key of [
      "student_id_no",
      "course",
      "course_year",
      "block",
      "gender",
      "email",
      "phone",
    ]) {
      if (!form[key].trim()) {
        throw new Error(
          "Complete every required student field.",
        );
      }
    }

    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      throw new Error("Enter a valid contact email.");
    }

    if (!/^[+\d ()-]{7,20}$/.test(form.phone)) {
      throw new Error("Enter a valid phone number.");
    }

    if (
      form.age &&
      (!/^\d+$/.test(form.age) ||
        Number(form.age) > 120)
    ) {
      throw new Error("Enter a valid age.");
    }

    notice.confirm(
      "Confirm Student Details",
      Object.entries(form)
        .map(
          ([key, value]) =>
            `${key}: ${value || "—"}`,
        )
        .join("\n") +
        "\nThese details become locked after saving. Check every field before confirming.",
      async () => {
        setBusy(true);

        try {
          const { supabase } = await import(
            "@/lib/supabase"
          );

          const { error } = await supabase
            .from("student_profiles")
            .upsert({
              ...form,
              user_id: userId,
              student_id_no:
                form.student_id_no.trim(),
              block: form.block.toUpperCase().trim(),
              age: form.age ? Number(form.age) : null,
            });

          if (error) throw error;

          await d.reload();
        } finally {
          setBusy(false);
        }
      },
    );
  }

  const selections: {
    key: string;
    label: string;
    items: string[];
  }[] = [
    {
      key: "course",
      label: "Course",
      items: cfg?.courses || [],
    },
    {
      key: "course_year",
      label: "Year Level",
      items: cfg?.years || [],
    },
    {
      key: "block",
      label: "Block",
      items: cfg?.blocks || [],
    },
    {
      key: "gender",
      label: "Gender",
      items: ["MALE", "FEMALE"],
    },
  ];

  return (
    <View style={s.card}>
      <Field
        label="Student ID"
        value={form.student_id_no}
        onChangeText={(value) =>
          updateField("student_id_no", value)
        }
      />

      {selections.map((selection) => (
        <View
          key={selection.key}
          style={{ gap: 8 }}
        >
          <Text style={s.label}>
            {selection.label}
          </Text>

          <Chips
            items={selection.items}
            value={form[selection.key]}
            onChange={(value) =>
              updateField(selection.key, value)
            }
          />
        </View>
      ))}

      <Field
        label="Email"
        value={form.email}
        onChangeText={(value) =>
          updateField("email", value)
        }
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Field
        label="Phone"
        value={form.phone}
        onChangeText={(value) =>
          updateField("phone", value)
        }
        keyboardType="phone-pad"
      />

      <Field
        label="Age (optional)"
        value={form.age}
        onChangeText={(value) =>
          updateField("age", value)
        }
        keyboardType="number-pad"
      />

      <Button
        title={
          busy
            ? "Saving…"
            : "Review & Save Student Details"
        }
        disabled={busy}
        onPress={() => notice.run(submit)}
      />
    </View>
  );
}