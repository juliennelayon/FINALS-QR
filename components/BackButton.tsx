import { useCallback } from "react";
import {
  BackHandler,
  Platform,
  Pressable,
  Text,
} from "react-native";
import {
  router,
  usePathname,
  useFocusEffect,
  useRootNavigationState,
  type Href,
} from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useData } from "@/lib/AppData";
import { backDestination } from "@/lib/navigation";
import { COLORS } from "@/constants/colors";

const adminParents: Partial<Record<string, Href>> = {
  "/admin/tools": "/admin/profile",
  "/admin/reports": "/admin/tools",
  "/admin/logs": "/admin/tools",
  "/admin/settings": "/admin/tools",
  "/requests": "/admin/tools",
};

const authRoutes = [
  "login",
  "register",
  "forgot-password",
  "reset-password",
];

export default function BackButton({
  onBack,
}: {
  onBack?: () => void;
}) {
  const { me } = useData();
  const pathname = usePathname();
  const rootState = useRootNavigationState();

  const goBack = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }

    if (me?.role === "administrator") {
      const destination = adminParents[pathname];

      if (destination) {
        router.replace(destination);
        return;
      }
    }

    const previousIndex = (rootState?.index ?? 0) - 1;
    const previous = rootState?.routes[previousIndex];

    const authHistory =
      !!me && authRoutes.includes(String(previous?.name));

    if (router.canGoBack() && !authHistory) {
      router.back();
      return;
    }

    router.replace(
      backDestination(pathname, me?.role) as Href,
    );
  }, [onBack, pathname, me, rootState]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === "web") return;

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          goBack();
          return true;
        },
      );

      return () => subscription.remove();
    }, [goBack]),
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={goBack}
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        minHeight: 48,
        minWidth: 80,
        alignSelf: "flex-start",
        paddingRight: 12,
        opacity: pressed ? 0.55 : 1,
      })}
    >
      <Ionicons
        name="arrow-back"
        size={23}
        color={COLORS.primary}
      />

      <Text
        style={{
          color: COLORS.primary,
          fontWeight: "700",
          fontSize: 15,
        }}
      >
        Back
      </Text>
    </Pressable>
  );
}