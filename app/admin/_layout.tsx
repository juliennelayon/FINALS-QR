import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useData } from "@/lib/AppData";
import { COLORS } from "@/constants/colors";

type AdminTab = {
  name: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  visible: boolean;
};

const tabs: AdminTab[] = [
  {
    name: "index",
    title: "Home",
    icon: "home-outline",
    visible: true,
  },
  {
    name: "users",
    title: "Users",
    icon: "people-outline",
    visible: true,
  },
  {
    name: "events",
    title: "Events",
    icon: "calendar-outline",
    visible: true,
  },
  {
    name: "attendance",
    title: "Attendance",
    icon: "list-outline",
    visible: true,
  },
  {
    name: "profile",
    title: "Profile",
    icon: "person-outline",
    visible: true,
  },
  {
    name: "tools",
    title: "Admin Panel",
    icon: "grid-outline",
    visible: false,
  },
  {
    name: "reports",
    title: "Reports",
    icon: "bar-chart-outline",
    visible: false,
  },
  {
    name: "settings",
    title: "Settings",
    icon: "settings-outline",
    visible: false,
  },
  {
    name: "logs",
    title: "Activity Logs",
    icon: "time-outline",
    visible: false,
  },
];

export default function AdminLayout() {
  const { me } = useData();

  if (
    me?.role !== "administrator" ||
    me.suspended ||
    me.status !== "approved"
  ) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          height: 68,
          paddingTop: 6,
          paddingBottom: 8,
        },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            href: tab.visible ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name={tab.icon}
                size={size}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}