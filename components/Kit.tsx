import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import BackButton from "./BackButton";
import { COLORS as C } from "@/constants/colors";

export const s = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: C.background,
  },
  wrap: {
    padding: 20,
    gap: 16,
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  title: {
    fontSize: 27,
    fontWeight: "800",
    color: C.textPrimary,
  },
  h: {
    fontSize: 18,
    fontWeight: "700",
    color: C.textPrimary,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    color: C.textPrimary,
  },
  muted: {
    fontSize: 13,
    lineHeight: 20,
    color: C.textSecondary,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  input: {
    fontSize: 15,
    color: C.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flex: 1,
    minWidth: 0,
  },
  field: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 13,
    backgroundColor: "#FAFDFC",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: C.textPrimary,
  },
  btn: {
    backgroundColor: C.primary,
    borderRadius: 13,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: 48,
  },
  btnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
  },
  link: {
    color: C.primary,
    fontWeight: "700",
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 30,
    backgroundColor: C.card,
  },
  chipOn: {
    backgroundColor: C.surface,
    borderColor: C.primary,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    alignSelf: "flex-start",
    backgroundColor: C.surface,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: C.primary,
    textTransform: "capitalize",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  stat: {
    flex: 1,
    minWidth: 130,
  },
  error: {
    color: C.danger,
    fontSize: 14,
    lineHeight: 21,
  },
  line: {
    height: 1,
    backgroundColor: C.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "#052E2670",
    justifyContent: "center",
    padding: 16,
  },
  modal: {
    width: "100%",
    maxWidth: 640,
    maxHeight: "92%",
    alignSelf: "center",
    backgroundColor: "#FFF",
    borderRadius: 22,
    padding: 22,
    gap: 14,
  },
});

export function Txt({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <Text style={muted ? s.muted : s.text}>
      {children}
    </Text>
  );
}

export function Button({
  title,
  onPress,
  disabled = false,
  secondary = false,
  danger = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        secondary && { backgroundColor: C.surface },
        danger && { backgroundColor: "#FFE4E6" },
        (disabled || pressed) && { opacity: 0.55 },
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={19}
          color={
            danger
              ? C.danger
              : secondary
                ? C.primary
                : "#FFF"
          }
        />
      )}

      <Text
        style={[
          s.btnText,
          secondary && { color: C.primary },
          danger && { color: C.danger },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  password = false,
  ...props
}: TextInputProps & {
  label: string;
  password?: boolean;
}) {
  const [show, setShow] = useState(false);
  const [focus, setFocus] = useState(false);

  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>

      <View
        style={[
          s.field,
          focus && {
            borderColor: C.primary,
            borderWidth: 2,
          },
        ]}
      >
        {(password || /email|full name/i.test(label)) && (
          <Ionicons
            name={
              password
                ? "lock-closed-outline"
                : /email/i.test(label)
                  ? "mail-outline"
                  : "person-outline"
            }
            size={19}
            color={C.textSecondary}
            style={{ marginLeft: 10 }}
          />
        )}

        <TextInput
          {...props}
          accessibilityLabel={label}
          autoCorrect={false}
          placeholderTextColor={C.textSecondary}
          secureTextEntry={password && !show}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={[
            s.input,
            props.multiline && {
              minHeight: 90,
              textAlignVertical: "top",
            },
            props.style,
          ]}
        />

        {password && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              show ? "Hide password" : "Show password"
            }
            onPress={() => setShow(!show)}
            style={{ padding: 12 }}
          >
            <Ionicons
              name={
                show
                  ? "eye-off-outline"
                  : "eye-outline"
              }
              size={22}
              color={C.textSecondary}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function Chips({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={s.row}>
      {items.map((x) => (
        <Pressable
          key={x}
          accessibilityRole="button"
          accessibilityState={{
            selected: value === x,
          }}
          onPress={() => onChange(x)}
          style={[
            s.chip,
            value === x && s.chipOn,
          ]}
        >
          <Text
            style={[
              s.muted,
              value === x && s.link,
            ]}
          >
            {x}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Badge({
  value,
  centered = false,
}: {
  value: string;
  centered?: boolean;
}) {
  const danger = [
    "absent",
    "cancelled",
    "rejected",
    "declined",
    "suspended",
  ].includes(value.toLowerCase());

  const warn = [
    "late",
    "pending",
    "closed",
  ].includes(value.toLowerCase());

  return (
    <View
      style={[
        s.badge,
        centered && { alignSelf: "center" },
        danger && {
          backgroundColor: "#FFE4E6",
        },
        warn && {
          backgroundColor: "#FEF3C7",
        },
      ]}
    >
      <Text
        style={[
          s.badgeText,
          danger && { color: C.danger },
          warn && { color: C.warning },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export function Avatar({
  url,
  name,
  size = 48,
}: {
  url?: string | null;
  name?: string | null;
  size?: number;
}) {
  return url ? (
    <Image
      source={{ uri: url }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
      }}
    />
  ) : (
    <View
      style={[
        s.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <Text
        style={[
          s.h,
          { fontSize: size * 0.32 },
        ]}
      >
        {(name || "S")
          .split(" ")
          .slice(0, 2)
          .map((x) => x[0])
          .join("")
          .toUpperCase()}
      </Text>
    </View>
  );
}

export function Empty({
  title,
  body = "Try another filter or check back later.",
}: {
  title: string;
  body?: string;
}) {
  return (
    <View
      style={[
        s.card,
        {
          alignItems: "center",
          paddingVertical: 35,
        },
      ]}
    >
      <Ionicons
        name="file-tray-outline"
        size={38}
        color={C.primary}
      />

      <Text style={s.h}>{title}</Text>
      <Txt muted>{body}</Txt>
    </View>
  );
}

export function Page({
  title,
  subtitle,
  children,
  refreshing = false,
  onRefresh,
  actions,
  back = false,
  onBack,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  actions?: React.ReactNode;
  back?: boolean;
  onBack?: () => void;
}) {
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={s.page}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.primary}
            />
          ) : undefined
        }
      >
        <View style={s.wrap}>
          {back && <BackButton onBack={onBack} />}

          <View
            style={[
              s.row,
              { justifyContent: "space-between" },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{title}</Text>
              {subtitle && <Txt muted>{subtitle}</Txt>}
            </View>

            {actions}
          </View>

          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Sheet({
  title,
  visible,
  onClose,
  children,
}: {
  title: string;
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={s.backdrop}
        behavior={
          Platform.OS === "ios" ? "padding" : undefined
        }
      >
        <View style={s.modal}>
          <View
            style={[
              s.row,
              { justifyContent: "space-between" },
            ]}
          >
            <Text style={s.h}>{title}</Text>

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close dialog"
              style={{ padding: 8 }}
            >
              <Ionicons
                name="close"
                size={24}
                color={C.textPrimary}
              />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <View
              style={{
                gap: 14,
                paddingBottom: 12,
              }}
            >
              {children}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Stat({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string | number;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={
        onPress ? "button" : undefined
      }
      onPress={onPress}
      style={[s.card, s.stat]}
    >
      <Text style={[s.title, { fontSize: 29 }]}>
        {value}
      </Text>

      <Txt muted>{label}</Txt>
    </Pressable>
  );
}

export function AuthFrame({
  children,
  back = false,
}: {
  children: React.ReactNode;
  back?: boolean;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= 1000;

  return (
    <SafeAreaView style={s.page}>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 380,
          height: 380,
          borderRadius: 190,
          backgroundColor: "#D1FAE5",
          opacity: 0.45,
          top: -160,
          right: -170,
        }}
      />

      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 280,
          height: 280,
          borderRadius: 140,
          borderWidth: 38,
          borderColor: "#A7F3D0",
          opacity: 0.18,
          bottom: -100,
          left: -130,
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : Platform.OS === "android"
              ? "height"
              : undefined
        }
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: width < 400 ? 16 : 24,
            paddingTop: 24,
            paddingBottom: 48,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === "ios"
              ? "interactive"
              : "on-drag"
          }
          showsVerticalScrollIndicator
          alwaysBounceVertical
        >
          <View
            style={{
              flexDirection: wide ? "row" : "column",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              gap: wide ? 60 : 16,
              width: "100%",
              maxWidth: 1080,
              alignSelf: "center",
            }}
          >
            <View
              style={{
                alignItems: "center",
                width: wide ? 380 : "100%",
                flexShrink: 0,
              }}
            >
              <Image
                source={require("@/assets/images/qr-logo.png")}
                resizeMode="contain"
                style={{
                  width: wide ? 340 : 190,
                  height: wide ? 360 : 190,
                }}
              />

              {wide && (
                <>
                  <Text
                    style={[
                      s.title,
                      {
                        marginTop: 20,
                        textAlign: "center",
                      },
                    ]}
                  >
                    Be present. Stay connected.
                  </Text>

                  <Text
                    style={[
                      s.muted,
                      {
                        textAlign: "center",
                        marginTop: 6,
                      },
                    ]}
                  >
                    School events and attendance, together in ScanIn.
                  </Text>
                </>
              )}
            </View>

            <View
              style={[
                s.card,
                {
                  width: "100%",
                  maxWidth: 470,
                  flexShrink: 0,
                  padding: width < 400 ? 20 : 28,
                  shadowColor: C.shadow,
                  shadowOpacity: 0.07,
                  shadowRadius: 24,
                  elevation: 3,
                },
              ]}
            >
              {back && <BackButton />}
              {children}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}