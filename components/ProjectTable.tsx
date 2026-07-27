'use client';

import { useEffect, useMemo, useState } from 'react';
import { contractorMatches, demoContractors } from '@/lib/contractor';
import { money, readProjects, type ProjectRecord, updateProject } from '@/lib/project';

type Mode = 'homeowner' | 'admin' | 'contractor';

export function ProjectTable({ mode }: { mode: Mode }) {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [selected, setSelected] = useState<ProjectRecord | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const load = () => setProjects(readProjects());
    load();
    window.addEventListener('storage', load);
    window.addEventListener('homequote-projects-changed', load);
    return () => {
      window.removeEventListener('storage', load);
      window.removeEventListener('homequote-projects-changed', load);
    };
  }, []);

  const visibleProjects = useMemo(() => {
    if (mode !== 'contractor') return projects;
    return projects.filter((project) => project.status === 'Contractor matching' || project.assignedContractorId === 'contractor-vividpro');
  }, [mode, projects]);

  const totals = useMemo(() => ({
    count: visibleProjects.length,
    review: visibleProjects.filter((p) => p.status === 'Under review' || p.status === 'AI generated').length,
    active: visibleProjects.filter((p) => ['Assigned', 'Accepted', 'In progress'].includes(p.status)).length,
    value: visibleProjects.reduce((sum, p) => sum + (mode === 'contractor' ? p.estimate.contractorPayoutHigh : p.estimate.customerPriceHigh), 0),
  }), [mode, visibleProjects]);

  function refreshSelected(id: string) {
    setSelected(readProjects().find((project) => project.id === id) || null);
  }

  function setStatus(project: ProjectRecord, status: ProjectRecord['status'], extra: Partial<ProjectRecord> = {}) {
    updateProject(project.id, { status, ...extra });
    refreshSelected(project.id);
  }

  function assign(project: ProjectRecord, contractorId: string) {
    const contractor = demoContractors.find((item) => item.id === contractorId);
    if (!contractor) return;
    setStatus(project, 'Assigned', {
      assignedContractorId: contractor.id,
      assignedContractorName: contractor.businessName,
    });
  }

  function saveNotes(project: ProjectRecord) {
    updateProject(project.id, { adminNotes: notes });
    refreshSelected(project.id);
  }

  function open(project: ProjectRecord) {
    setSelected(project);
    setNotes(project.adminNotes || '');
  }

  return <>
    <div className="grid">
      <div className="card"><div className="muted">{mode === 'contractor' ? 'Available and assigned jobs' : 'Saved projects'}</div><div className="metric">{totals.count}</div></div>
      <div className="card"><div className="muted">{mode === 'contractor' ? 'Active jobs' : 'Awaiting review'}</div><div className="metric">{mode === 'contractor' ? totals.active : totals.review}</div></div>
      <div className="card"><div className="muted">{mode === 'contractor' ? 'Potential contractor earnings' : 'Estimated project value'}</div><div className="metric">{money(totals.value)}</div></div>
    </div>
    <section className="card" style={{ marginTop: 20 }}>
      <div className="section-row"><div><span className="eyebrow">Live preview data</span><h2>{mode === 'admin' ? 'Estimate review and assignment queue' : mode === 'contractor' ? 'Contractor opportunities' : 'Your estimate requests'}</h2></div></div>
      {visibleProjects.length === 0 ? <div className="empty-state"><h3>No projects here yet</h3><p>{mode === 'contractor' ? 'An admin must move a project into contractor matching or assign it to VividPro.' : 'Complete the estimate wizard to create the first project. This preview stores data in this browser until Supabase is connected.'}</p>{mode !== 'contractor' && <a className="btn" href="/request">Start an estimate</a>}</div> :
      <div className="table-wrap"><table className="table"><thead><tr><th>Customer</th><th>Service</th><th>Status</th><th>{mode === 'contractor' ? 'Payout' : 'Estimate'}</th><th></th></tr></thead><tbody>{visibleProjects.map((project) => <tr key={project.id}><td>{project.homeowner.name || 'Homeowner'}<small>{project.address}, {project.city}, {project.state} {project.postalCode}</small></td><td>{project.service}<small>{project.assignedContractorName ? `Assigned: ${project.assignedContractorName}` : 'Not assigned'}</small></td><td><span className="status">{project.status}</span></td><td>{mode === 'contractor' ? `${money(project.estimate.contractorPayoutLow)}–${money(project.estimate.contractorPayoutHigh)}` : `${money(project.estimate.customerPriceLow)}–${money(project.estimate.customerPriceHigh)}`}</td><td><button className="btn secondary compact" onClick={() => open(project)}>Review</button></td></tr>)}</tbody></table></div>}
    </section>
    {selected && <div className="modal-backdrop" onMouseDown={() => setSelected(null)}><section className="modal card" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSelected(null)} aria-label="Close">×</button><span className="eyebrow">{selected.status}</span><h2>{selected.service}</h2><p>{selected.address}, {selected.city}, {selected.state} {selected.postalCode}</p><p><b>Homeowner:</b> {selected.homeowner.name} · {selected.homeowner.phone || selected.homeowner.email}</p><div className="review-price"><strong>{money(mode === 'contractor' ? selected.estimate.contractorPayoutLow : selected.estimate.customerPriceLow)}–{money(mode === 'contractor' ? selected.estimate.contractorPayoutHigh : selected.estimate.customerPriceHigh)}</strong><span>{mode === 'contractor' ? 'Target contractor payout' : `Contractor target: ${money(selected.estimate.contractorPayoutLow)}–${money(selected.estimate.contractorPayoutHigh)}`}</span></div><h3>Project description</h3><p>{selected.description}</p><h3>Scope</h3><ul>{selected.estimate.scope.map((item) => <li key={item.title}><b>{item.title}:</b> {item.description}</li>)}</ul>{selected.photoNames.length > 0 && <p><b>Uploaded files:</b> {selected.photoNames.join(', ')}</p>}{selected.assignedContractorName && <div className="alert"><b>Assigned contractor:</b> {selected.assignedContractorName}</div>}
      {mode === 'admin' && <><label className="full">Internal notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Inspection notes, price changes or assignment instructions" /></label><div className="modal-actions"><button className="btn secondary" onClick={() => saveNotes(selected)}>Save notes</button><button className="btn secondary" onClick={() => setStatus(selected, 'Under review')}>Mark under review</button><button className="btn" onClick={() => setStatus(selected, 'Approved')}>Approve estimate</button><button className="btn secondary" onClick={() => setStatus(selected, 'Contractor matching')}>Start matching</button></div>{['Approved', 'Contractor matching', 'Assigned'].includes(selected.status) && <div className="match-list"><h3>Matching contractors</h3>{contractorMatches(selected.service, selected.state, selected.postalCode).map((contractor) => <div className="match-card" key={contractor.id}><div><b>{contractor.businessName}</b><p>{contractor.nationwide ? 'Nationwide coverage' : `${contractor.city}, ${contractor.state}`} · {contractor.rating}★ · {contractor.completedJobs} completed jobs</p><small>{contractor.availability} · {contractor.nationwide ? 'All U.S. states' : `${contractor.radiusMiles}-mile service radius`}</small></div><button className="btn compact" onClick={() => assign(selected, contractor.id)}>Assign</button></div>)}</div>}</>}
      {mode === 'contractor' && <div className="modal-actions">{selected.status === 'Contractor matching' && <button className="btn" onClick={() => assign(selected, 'contractor-vividpro')}>Accept and assign to VividPro</button>}{selected.status === 'Assigned' && selected.assignedContractorId === 'contractor-vividpro' && <button className="btn" onClick={() => setStatus(selected, 'Accepted', { contractorAcceptedAt: new Date().toISOString() })}>Accept assigned job</button>}{selected.status === 'Accepted' && <button className="btn" onClick={() => setStatus(selected, 'In progress', { startedAt: new Date().toISOString() })}>Start job</button>}{selected.status === 'In progress' && <button className="btn" onClick={() => setStatus(selected, 'Completed', { completedAt: new Date().toISOString() })}>Mark completed</button>}</div>}
    </section></div>}
  </>;
}
