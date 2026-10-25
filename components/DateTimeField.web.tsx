import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, s, Sheet, Txt } from "./Kit";
import { parsePH, phDate } from "@/lib/domain";
import { COLORS } from "@/constants/colors";
export type DateTimeFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};
export default function DateTimeField({
  label,
  value,
  onChange,
}: DateTimeFieldProps) {
  const [open, O] = useState(false),
    [draft, D] = useState(value),
    [error, E] = useState("");
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Choose ${label}`}
        onPress={() => {
          D(value);
          E("");
          O(true);
        }}
        style={[s.field, { minHeight: 54, padding: 13, gap: 10 }]}
      >
        <Ionicons name="calendar-outline" size={21} color={COLORS.primary} />
        <View style={{ flex: 1 }}>
          <Text style={s.text}>{phDate(parsePH(value))}</Text>
          <Text style={s.muted}>Philippine Time · tap to change</Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={COLORS.primary} />
      </Pressable>
      {open && (
        <Sheet title={label} visible onClose={() => O(false)}>
          <Txt muted>
            Choose the date and time in Philippine Time (Asia/Manila).
          </Txt>
          <input
            aria-label={`${label} selection`}
            type="datetime-local"
            value={draft.replace(" ", "T")}
            onChange={(event) => D(event.target.value.replace("T", " "))}
            style={{
              width: "100%",
              boxSizing: "border-box",
              minHeight: 52,
              borderRadius: 12,
              border: "1px solid #C9DFD5",
              padding: 12,
              fontSize: 16,
              color: "#064E3B",
              background: "#FAFDFC",
            }}
          />
          {!!error && <Text style={s.error}>{error}</Text>}
          <Button
            title={`Use ${label}`}
            onPress={() => {
              try {
                parsePH(draft);
                onChange(draft);
                O(false);
              } catch (e) {
                E(
                  e instanceof Error
                    ? e.message
                    : "Choose a valid date and time.",
                );
              }
            }}
          />
        </Sheet>
      )}
    </View>
  );
}
