import { useState } from "react";
import { Link } from "expo-router";
import * as Linking from "expo-linking";
import { Text, View } from "react-native";
import { AuthFrame, Button, Chips, Field, s, Txt } from "@/components/Kit";
import { signIn, signUp } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export default function Register() {
  const [name, N] = useState(""),
    [email, E] = useState(""),
    [pass, P] = useState(""),
    [confirm, C] = useState(""),
    [role, R] = useState("Student"),
    [busy, B] = useState(false),
    [error, X] = useState(""),
    [success, S] = useState(false);
  async function submit() {
    if (busy) return;
    X("");
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      X("Enter your full name and a valid email.");
      return;
    }
    if (pass.length < 8) {
      X("Use at least 8 characters for your password.");
      return;
    }
    if (pass !== confirm) {
      X("Passwords do not match.");
      return;
    }
    B(true);
    try {
      const { error } = await signUp(email.trim(), pass, {
        full_name: name.trim(),
        role: role === "Student" ? "student" : "teacher",
      });
      if (error) X(error.message);
      else S(true);
    } catch {
      X("Unable to connect. Please try again.");
    } finally {
      B(false);
    }
  }
  return (
    <AuthFrame back>
      <Text style={s.title}>
        {success ? "Check your email" : "Join ScanIn"}
      </Text>
      <Txt muted>
        {success
          ? "Follow the verification link, then sign in. Teacher accounts also require administrator approval."
          : "Your school events and attendance, in one place."}
      </Txt>
      {!success && (
        <>
          <Chips
            items={["Student", "Teacher"]}
            value={role}
            onChange={(v) => !busy && R(v)}
          />
          <Field
            label="Full Name"
            value={name}
            onChangeText={N}
            placeholder="Enter your full name"
            editable={!busy}
            autoComplete="name"
          />
          <Field
            label="Email"
            value={email}
            onChangeText={E}
            placeholder="you@example.com"
            editable={!busy}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Field
            label="Password"
            password
            value={pass}
            onChangeText={P}
            placeholder="Create a password"
            editable={!busy}
            autoComplete="new-password"
          />
          <Txt muted>
            At least 8 characters ·{" "}
            {pass.length >= 8
              ? "✓ Length requirement met"
              : "Choose a strong, unique password"}
          </Txt>
          <Field
            label="Confirm Password"
            password
            value={confirm}
            onChangeText={C}
            placeholder="Confirm your password"
            editable={!busy}
            onSubmitEditing={submit}
          />
          {!!error && <Text style={s.error}>{error}</Text>}
          <Button
            title={busy ? "Creating account…" : "Create Account →"}
            onPress={submit}
            disabled={busy}
          />
        </>
      )}
      <View style={s.line} />
      <Text style={[s.muted, { textAlign: "center" }]}>
        Already have an account?{" "}
        <Link href="/login" style={s.link}>
          Sign In
        </Link>
      </Text>
      <Txt muted>Teacher accounts require administrator approval.</Txt>
    </AuthFrame>
  );
}
