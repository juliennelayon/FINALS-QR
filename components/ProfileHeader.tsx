import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useData } from "@/lib/AppData";
import { uploadImage } from "@/lib/api";
import { pickImage } from "@/lib/images";
import { COLORS } from "@/constants/colors";
import { Avatar, Badge, Button, Sheet, Txt } from "./Kit";
import { useNotice } from "./Notice";

type PhotoKind = "avatar" | "cover";

export default function ProfileHeader() {
  const d = useData();
  const notice = useNotice();
  const me = d.me;

  const [busy, setBusy] = useState(false);
  const [photoKind, setPhotoKind] =
    useState<PhotoKind>("avatar");
  const [selectedPicture, setSelectedPicture] =
    useState<string | null>(null);

  async function choosePicture(kind: PhotoKind) {
    if (busy) return;

    setBusy(true);

    try {
      const uri = await pickImage(
  true,
  kind === "cover" ? [16, 9] : [1, 1],
);

      if (uri) {
        setPhotoKind(kind);
        setSelectedPicture(uri);
      }
    } catch (error) {
      notice.info(
        error instanceof Error
          ? error.message
          : "Unable to choose a picture.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function savePicture() {
    if (!me || !selectedPicture || busy) return;

    setBusy(true);

    try {
      // Both photos use the existing user-owned image folder.
      const url = await uploadImage(
        selectedPicture,
        "avatar",
        me.id,
      );

      await d.act("scanin_profile_update", {
        changes:
          photoKind === "cover"
            ? { cover_url: url }
            : { avatar_url: url },
      });

      setSelectedPicture(null);
    } finally {
      setBusy(false);
    }
  }

  if (!me) return null;

  const coverUrl = (
    me as { cover_url?: string | null }
  ).cover_url;

  const roleLabel =
    me.role === "administrator"
      ? "Administrator"
      : me.role === "teacher"
        ? "Teacher"
        : "Student";

  return (
    <>
      <View
        style={{
          backgroundColor: COLORS.card,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: COLORS.border,
          overflow: "hidden",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change cover photo"
          disabled={busy}
          onPress={() => void choosePicture("cover")}
          style={({ pressed }) => ({
            height: 180,
            backgroundColor: COLORS.primary,
            justifyContent: "center",
            overflow: "hidden",
            opacity: pressed ? 0.8 : 1,
          })}
        >
          {coverUrl ? (
            <Image
              source={{ uri: coverUrl }}
              resizeMode="cover"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            />
          ) : (
            <View
              pointerEvents="none"
              style={{ paddingHorizontal: 24 }}
            >
              <View
                style={{
                  position: "absolute",
                  width: 210,
                  height: 210,
                  borderRadius: 105,
                  backgroundColor: "rgba(255,255,255,0.10)",
                  right: -35,
                  top: -100,
                }}
              />

              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 26,
                  fontWeight: "800",
                  letterSpacing: 1,
                }}
              >
                ScanIn
              </Text>

              <Text
                style={{
                  color: "#D1FAE5",
                  fontSize: 13,
                  marginTop: 4,
                }}
              >
                Tap the background to add a cover photo
              </Text>
            </View>
          )}

          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              backgroundColor: "rgba(0,0,0,0.45)",
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name="camera"
              size={19}
              color="#FFFFFF"
            />
          </View>
        </Pressable>

        <View
          style={{
            alignItems: "center",
            paddingHorizontal: 20,
            paddingBottom: 24,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change profile picture"
            disabled={busy}
            onPress={() => void choosePicture("avatar")}
            style={({ pressed }) => ({
              marginTop: -54,
              zIndex: 2,
              borderRadius: 70,
              padding: 5,
              backgroundColor: COLORS.card,
              opacity: pressed || busy ? 0.65 : 1,
            })}
          >
            <Avatar
              url={me.avatar_url}
              name={me.full_name}
              size={110}
            />

            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                right: 2,
                bottom: 4,
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: COLORS.primary,
                borderWidth: 3,
                borderColor: COLORS.card,
              }}
            >
              <Ionicons
                name="camera"
                size={17}
                color="#FFFFFF"
              />
            </View>
          </Pressable>

          <Text
            style={{
              fontSize: 24,
              fontWeight: "800",
              color: COLORS.textPrimary,
              textAlign: "center",
              marginTop: 12,
              marginBottom: 8,
            }}
          >
            {me.full_name || "My Profile"}
          </Text>

          <Badge centered value={roleLabel} />

          <Text
            style={{
              color: COLORS.textSecondary,
              textAlign: "center",
              marginTop: 8,
              fontSize: 14,
            }}
          >
            {me.email}
          </Text>

          {busy && (
            <Text
              style={{
                color: COLORS.textSecondary,
                marginTop: 10,
              }}
            >
              Please wait…
            </Text>
          )}
        </View>
      </View>

      <Sheet
        title={
          photoKind === "cover"
            ? "Cover Photo"
            : "Profile Picture"
        }
        visible={!!selectedPicture}
        onClose={() => {
          if (!busy) setSelectedPicture(null);
        }}
      >
        {selectedPicture && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose another photo"
            disabled={busy}
            onPress={() => void choosePicture(photoKind)}
            style={{
              alignSelf:
                photoKind === "cover" ? "stretch" : "center",
            }}
          >
            <Image
              source={{ uri: selectedPicture }}
              resizeMode="cover"
              style={
                photoKind === "cover"
                  ? {
                      width: "100%",
                      height: 180,
                      borderRadius: 16,
                    }
                  : {
                      width: 220,
                      height: 220,
                      borderRadius: 110,
                    }
              }
            />

            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                right: 12,
                bottom: 12,
                backgroundColor: COLORS.primary,
                padding: 10,
                borderRadius: 24,
              }}
            >
              <Ionicons
                name="camera"
                size={20}
                color="#FFFFFF"
              />
            </View>
          </Pressable>
        )}

        <Txt muted>
          Tap the photo to choose another image.
        </Txt>

        <Button
          title={
            busy
              ? "Saving…"
              : photoKind === "cover"
                ? "Save Cover Photo"
                : "Save Profile Picture"
          }
          disabled={busy}
          onPress={() => notice.run(savePicture)}
        />
      </Sheet>
    </>
  );
}