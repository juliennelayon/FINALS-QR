import { useState } from "react";
import { Link } from "expo-router";
import * as Linking from "expo-linking";
import { Text, View } from "react-native";
import { AuthFrame, Button, Chips, Field, s, Txt } from "@/components/Kit";
import { signIn, signUp } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export default function ResetPassword() {
  const [pass, P] = useState(""),
    [confirm, C] = useState(""),
    [message, M] = useState(""),
    [busy, B] = useState(false);
  return (
    <AuthFrame back>
      <Text style={s.title}>Choose a new password</Text>
      <Field label="New Password" password value={pass} onChangeText={P} />
      <Field
        label="Confirm Password"
        password
        value={confirm}
        onChangeText={C}
      />
      {!!message && <Txt>{message}</Txt>}
      <Button
        title={busy ? "Saving…" : "Save New Password"}
        disabled={busy}
        onPress={async () => {
          if (pass.length < 8 || pass !== confirm) {
            M("Use at least 8 characters and matching passwords.");
            return;
          }
          B(true);
          try {
            const { error } = await supabase.auth.updateUser({
              password: pass,
            });
            if (error) throw error;
            await supabase.auth.signOut();
            M("Password updated. Return to Sign In.");
          } catch (e: any) {
            M(e.message);
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
