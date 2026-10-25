import React, { createContext, useContext, useState } from "react";
import { Text } from "react-native";
import { Button, Field, s, Sheet, Txt } from "./Kit";
const Context = createContext<any>(null);
export function NoticeProvider({ children }: { children: React.ReactNode }) {
  const [message, M] = useState(""),
    [prompt, P] = useState<any>(null),
    [value, V] = useState(""),
    [busy, B] = useState(false);
  function info(v: string) {
    M(v);
  }
  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (e: any) {
      M(e.message || "Unable to complete this action.");
    }
  }
  return (
    <Context.Provider
      value={{
        info,
        run,
        confirm: (title: string, body: string, action: () => Promise<void>) => {
          V("");
          P({ title, body, action, needsReason: false });
        },
        prompt: (
          title: string,
          body: string,
          action: (reason: string) => Promise<void>,
        ) => {
          V("");
          P({ title, body, action });
        },
      }}
    >
      {children}
      <Sheet title="ScanIn" visible={!!message} onClose={() => M("")}>
        <Txt>{message}</Txt>
        <Button title="OK" onPress={() => M("")} />
      </Sheet>
      <Sheet
        title={prompt?.title || ""}
        visible={!!prompt}
        onClose={() => !busy && P(null)}
      >
        <Txt>{prompt?.body}</Txt>
        {prompt?.needsReason !== false && (
          <Field label="Reason" value={value} onChangeText={V} multiline />
        )}
        <Button
          title={busy ? "Processing…" : "Confirm"}
          disabled={busy || (prompt?.needsReason !== false && !value.trim())}
          onPress={async () => {
            B(true);
            try {
              await prompt.action(value.trim());
              P(null);
            } catch (e: any) {
              M(e.message);
            } finally {
              B(false);
            }
          }}
        />
        <Button
          title="Cancel"
          secondary
          disabled={busy}
          onPress={() => P(null)}
        />
      </Sheet>
    </Context.Provider>
  );
}
export function useNotice() {
  return useContext(Context);
}
