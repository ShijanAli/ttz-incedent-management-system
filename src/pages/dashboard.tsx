import { DashboardOverview } from '@/components/dashboard/dashboard-overview';

/** One dashboard for every role, backed by GET /dashboard and GET /projects/{id}/dashboard */
export default function DashboardPage() {
  return <DashboardOverview />;
}
