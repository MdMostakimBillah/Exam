import { fetchDashboardData } from "@/lib/data/dashboard";
import { SuperAdminDashboardView } from "./dashboard-view";

export default async function SuperAdminPage() {
  const data = await fetchDashboardData();
  return <SuperAdminDashboardView data={data} />;
}
