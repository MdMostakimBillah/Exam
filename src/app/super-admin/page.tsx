import { fetchDashboardData } from "@/lib/data/dashboard";
import { SuperAdminDashboardView } from "./dashboard-view";

export default async function SuperAdminPage() {
  const { data, stats } = await fetchDashboardData();
  return <SuperAdminDashboardView data={data} stats={stats} />;
}
