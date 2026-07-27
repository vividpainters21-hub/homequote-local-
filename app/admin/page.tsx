import { DashboardShell } from '@/components/DashboardShell';
import { ProjectTable } from '@/components/ProjectTable';

export default function Page() {
  return <DashboardShell title="Admin Control Center"><ProjectTable mode="admin" /></DashboardShell>;
}
