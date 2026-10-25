import { useState } from "react";
import { Link } from "expo-router";
import * as Linking from "expo-linking";
import { Text, View } from "react-native";

import { AuthFrame, Button, Field, s } from "@/components/Kit";
import { signIn } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const [email, E] = useState("");
  const [pass, P] = useState("");
  const [busy, B] = useState(false);
  const [error, X] = useState("");
  const [verify, V] = useState(false);

  async function submit() {
    if (busy) return;

    X("");
    V(false);

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      X("Enter a valid email address.");
      return;
    }

    if (!pass) {
      X("Enter your password.");
      return;
    }

    B(true);

    try {
      const { error } = await signIn(email.trim(), pass);

      if (error) {
        V(error.code === "email_not_confirmed");

        X(
          error.code === "invalid_credentials"
            ? "Email or password is incorrect."
            : error.message,
        );
      }
    } catch {
      X("Unable to connect. Please try again.");
    } finally {
      B(false);
    }
  }

  return (
    <AuthFrame>
      <View
        style={{
          width: "100%",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Text style={[s.title, { textAlign: "center" }]}>
          Welcome back!
        </Text>

        <Text style={[s.muted, { textAlign: "center" }]}>
          Sign in to your ScanIn account.
        </Text>
      </View>

      <Field
        label="Email"
        value={email}
        onChangeText={E}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        editable={!busy}
      />

      <Field
        label="Password"
        password
        value={pass}
        onChangeText={P}
        placeholder="Enter your password"
        autoCapitalize="none"
        autoComplete="current-password"
        editable={!busy}
        onSubmitEditing={submit}
      />

      <Link
        href="/forgot-password"
        style={[
          s.link,
          {
            textAlign: "right",
            paddingVertical: 8,
          },
        ]}
      >
        Forgot Password?
      </Link>

      {!!error && (
        <Text
          accessibilityLiveRegion="polite"
          style={s.error}
        >
          {error}
        </Text>
      )}

      {verify && (
        <Button
          title="Resend Verification"
          secondary
          onPress={async () => {
            const { error } = await supabase.auth.resend({
              type: "signup",
              email: email.trim(),
              options: {
                emailRedirectTo: Linking.createURL("login"),
              },
            });

            X(
              error?.message ||
                "Check your email for a verification link.",
            );
          }}
        />
      )}

      <Button
        title={busy ? "Signing in…" : "Sign In →"}
        onPress={submit}
        disabled={busy}
      />

      <View style={s.line} />

      <Text style={[s.muted, { textAlign: "center" }]}>
        Don’t have an account?{" "}
        <Link href="/register" style={s.link}>
          Register
        </Link>
      </Text>
    </AuthFrame>
  );
}