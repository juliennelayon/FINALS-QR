import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useData } from "@/lib/AppData";
export default function Layout() {
  const { me } = useData();
  const student = me?.role === "student";
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#047857",
        tabBarInactiveTintColor: "#52675F",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#C9DFD5",
          height: 68,
          paddingBottom: 8,
          paddingTop: 6,
        },
      }}
    >
      {[
        ["index", student ? "Home" : "Home", "home-outline", true],
        ["events", "Events", "calendar-outline", student],
        ["teacher", "My Events", "calendar-outline", !student],
        ["scan", "Scan", "scan-outline", student],
        [
          "history",
          student ? "History" : "Attendance",
          student ? "time-outline" : "people-outline",
          true,
        ],
        ["profile", "Profile", "person-outline", true],
      ].map(([name, title, icon, visible]) => (
        <Tabs.Screen
          key={String(name)}
          name={String(name)}
          options={{
            title: String(title),
            href: visible ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={icon as any} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
