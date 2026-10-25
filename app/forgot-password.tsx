import { useState } from "react";
import { Link } from "expo-router";
import * as Linking from "expo-linking";
import { Text, View } from "react-native";
import { AuthFrame, Button, Chips, Field, s, Txt } from "@/components/Kit";
import { signIn, signUp } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export default function ForgotPassword() {
  const [email, E] = useState(""),
    [message, M] = useState(""),
    [busy, B] = useState(false);
  return (
    <AuthFrame back>
      <Text style={s.title}>Reset your password</Text>
      <Txt muted>We’ll email you a link to choose a new password.</Txt>
      <Field
        label="Email"
        value={email}
        onChangeText={E}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      {!!message && <Txt>{message}</Txt>}
      <Button
        title={busy ? "Sending…" : "Send Reset Link"}
        disabled={busy}
        onPress={async () => {
          if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
            M("Enter a valid email.");
            return;
          }
          B(true);
          try {
            const { error } = await supabase.auth.resetPasswordForEmail(
              email.trim(),
              { redirectTo: Linking.createURL("reset-password") },
            );
            M(
              error && /fetch|network/i.test(error.message)
                ? "Unable to connect. Please try again."
                : "If an account exists for this email, you will receive a reset link.",
            );
          } catch {
            M("Unable to connect. Please try again.");
          } finally {
            B(false);
          }
        }}
      />
      <Link href="/login" style={s.link}>
        Back to Sign In
      </Link>
    </AuthFrame>
  );
}
