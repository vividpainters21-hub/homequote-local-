import { DashboardShell } from '@/components/DashboardShell';
import { ProjectTable } from '@/components/ProjectTable';

export default function Page() {
  return <DashboardShell title="Homeowner Dashboard"><ProjectTable mode="homeowner" /></DashboardShell>;
}
