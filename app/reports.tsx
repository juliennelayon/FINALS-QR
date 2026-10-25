import { router } from "expo-router";
import { Page } from "@/components/Kit";
import ReportsContent from "@/components/ReportsContent";
import { useData } from "@/lib/AppData";

export default function AdminReports() {
  const d = useData();

  if (d.me?.role !== "administrator") {
    return null;
  }

  return (
    <Page
      back
      title="Reports & Analytics"
      subtitle="Attendance summaries and Top Attendees"
      onBack={() => router.replace("/admin/tools")}
      onRefresh={d.reload}
      refreshing={d.loading}
    >
      <ReportsContent />
    </Page>
  );
}