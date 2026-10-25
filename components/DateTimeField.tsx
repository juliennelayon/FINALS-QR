import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, s, Sheet, Txt } from "./Kit";
import { parsePH, phDate, phInput } from "@/lib/domain";
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
    [picker, P] = useState<"date" | "time" | null>(null),
    [error, E] = useState("");
  const selected = () => new Date(parsePH(draft));
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Choose ${label}`}
        onPress={() => {
          D(value);
          E("");
          P(null);
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
        <Sheet
          title={label}
          visible
          onClose={() => {
            O(false);
            P(null);
          }}
        >
          <Txt>{phDate(parsePH(draft))}</Txt>
          <Txt muted>Philippine Time (Asia/Manila)</Txt>
          <Button
            title="Choose Date"
            secondary
            icon="calendar-outline"
            onPress={() => P("date")}
          />
          <Button
            title="Choose Time"
            secondary
            icon="time-outline"
            onPress={() => P("time")}
          />
          {picker && (
            <DateTimePicker
              value={selected()}
              mode={picker}
              display={Platform.OS === "ios" ? "spinner" : "default"}
              timeZoneName="Asia/Manila"
              is24Hour={false}
              onChange={(event, date) => {
                if (Platform.OS !== "ios") P(null);
                if (event.type === "dismissed" || !date) return;
                const text = phInput(date.toISOString());
                D(
                  picker === "date"
                    ? text.slice(0, 10) + " " + draft.slice(11)
                    : draft.slice(0, 10) + " " + text.slice(11),
                );
              }}
            />
          )}
          {!!error && <Text style={s.error}>{error}</Text>}
          <Button
            title={`Use ${label}`}
            onPress={() => {
              try {
                parsePH(draft);
                onChange(draft);
                O(false);
                P(null);
              } catch (e) {
                E(
                  e instanceof Error
                    ? e.message
                    : "Select a valid date and time.",
                );
              }
            }}
          />
        </Sheet>
      )}
    </View>
  );
}
