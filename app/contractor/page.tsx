import { DashboardShell } from '@/components/DashboardShell';
import { ProjectTable } from '@/components/ProjectTable';

export default function Page() {
  return <DashboardShell title="Contractor Portal">
    <section className="card" style={{ marginBottom: 20 }}>
      <span className="eyebrow">Service-area profile</span>
      <h2>Choose where your company works</h2>
      <p className="muted">Production onboarding will let contractors select states, counties, ZIP codes and a travel radius. The matching engine already supports state and ZIP coverage.</p>
      <div className="grid">
        <div><b>Home market</b><p className="muted">Schenectady, New York 12305</p></div>
        <div><b>Travel radius</b><p className="muted">30 miles</p></div>
        <div><b>Coverage mode</b><p className="muted">Local service area</p></div>
      </div>
    </section>
    <ProjectTable mode="contractor" />
  </DashboardShell>;
}
