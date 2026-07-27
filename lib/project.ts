import type { Estimate } from './estimate';

export type ProjectStatus = 'AI generated' | 'Under review' | 'Approved' | 'Contractor matching' | 'Assigned' | 'Accepted' | 'In progress' | 'Completed';

export type ProjectRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ProjectStatus;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  service: string;
  description: string;
  squareFeet?: number;
  linearFeet?: number;
  rooms?: number;
  condition: string;
  materialsBy: string;
  timeline: string;
  homeowner: { name: string; email: string; phone: string };
  photoNames: string[];
  estimate: Estimate;
  adminNotes?: string;
  assignedContractorId?: string;
  assignedContractorName?: string;
  contractorAcceptedAt?: string;
  startedAt?: string;
  completedAt?: string;
};

export const PROJECT_STORAGE_KEY = 'homequote-local-projects-v1';

export function readProjects(): ProjectRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PROJECT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProjectRecord[]) : [];
  } catch {
    return [];
  }
}

export function writeProjects(projects: ProjectRecord[]) {
  window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projects));
  window.dispatchEvent(new Event('homequote-projects-changed'));
}

export function saveProject(project: ProjectRecord) {
  const projects = readProjects();
  writeProjects([project, ...projects.filter((item) => item.id !== project.id)]);
}

export function updateProject(id: string, updates: Partial<ProjectRecord>) {
  const projects = readProjects().map((project) =>
    project.id === id
      ? { ...project, ...updates, updatedAt: new Date().toISOString() }
      : project,
  );
  writeProjects(projects);
}

export function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}
