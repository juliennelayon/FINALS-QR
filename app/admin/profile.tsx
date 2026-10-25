import { router } from "expo-router";

import ProfileHeader from "@/components/ProfileHeader";
import { useData } from "@/lib/AppData";
import { signOut } from "@/lib/auth";
import { disconnectPush } from "@/lib/notifications";
import { Button, Page, Txt } from "@/components/Kit";
import { useNotice } from "@/components/Notice";

export default function AdminProfile() {
  const d = useData();
  const notice = useNotice();
  const me = d.me;

  if (!me) {
    return (
      <Page title="Profile">
        <Txt>Loading profile…</Txt>
      </Page>
    );
  }

  return (
    <Page
      back
      title="My Profile"
      onBack={() => router.replace("/admin")}
      onRefresh={d.reload}
      refreshing={d.loading}
    >
      <ProfileHeader />

      <Button
        title="Admin Panel"
        icon="grid-outline"
        onPress={() => router.push("/admin/tools")}
      />

      <Button
        title="Sign Out"
        danger
        onPress={() =>
          notice.run(async () => {
            try {
              await disconnectPush();
            } catch {
          
            }

            const result = await signOut();

            if (result.error) {
              throw new Error(result.error);
            }

            router.replace("/login");
          })
        }
      />
    </Page>
  );
}