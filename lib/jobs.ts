import { z } from 'zod';
import { US_STATES, validZip } from '@/lib/location';

export const SERVICES = ['Interior Painting', 'Exterior Painting', 'Drywall', 'Flooring', 'Bathroom Remodeling', 'Basement Waterproofing', 'General Remodeling'] as const;

export const JOB_STATUSES = ['new', 'quoted', 'approved', 'scheduled', 'in_progress', 'completed', 'lost'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const STATUS_LABEL: Record<JobStatus, string> = {
  new: 'New request',
  quoted: 'Quote sent',
  approved: 'Quote approved',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  lost: 'Closed',
};

/** The customer-facing timeline. "lost" is not a step; it closes the job. */
export const TIMELINE: JobStatus[] = ['new', 'quoted', 'approved', 'scheduled', 'in_progress', 'completed'];

const stateCodes = US_STATES.map(([code]) => code) as [string, ...string[]];
const optionalNumber = z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().positive().max(1_000_000).optional());

/** What the public request form sends. Everything is re-validated on the server. */
export const JobRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).default(''),
  address: z.string().trim().min(2).max(200),
  city: z.string().trim().min(2).max(100),
  state: z.enum(stateCodes),
  postalCode: z.string().refine(validZip, 'Enter a 5-digit ZIP code'),
  service: z.enum(SERVICES),
  description: z.string().trim().min(10).max(5000),
  squareFeet: optionalNumber,
  linearFeet: optionalNumber,
  rooms: optionalNumber,
  condition: z.string().max(100).default('Normal condition'),
  materialsBy: z.string().max(100).default('Not sure yet'),
  timeline: z.string().max(100).default('Flexible'),
});
export type JobRequest = z.infer<typeof JobRequestSchema>;

export interface JobRow {
  id: string;
  public_token: string;
  status: JobStatus;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  service: string;
  description: string;
  answers: Record<string, unknown>;
  ai_estimate: Record<string, unknown> | null;
  estimate_low_cents: number | null;
  estimate_high_cents: number | null;
  quote_cents: number | null;
  quote_details: string;
  quote_sent_at: string | null;
  approved_at: string | null;
  approved_signature: string | null;
  approved_ip: string | null;
  scheduled_for: string | null;
  internal_notes: string;
  created_at: string;
  updated_at: string;
}

export interface JobMessage {
  id: string;
  job_id: string;
  sender: 'customer' | 'contractor';
  body: string;
  created_at: string;
}

/** Columns a customer is allowed to see. Never includes internal notes, payout targets or IPs. */
export const PUBLIC_JOB_COLUMNS =
  'id, status, customer_name, address, city, state, zip, service, description, estimate_low_cents, estimate_high_cents, quote_cents, quote_details, quote_sent_at, approved_at, approved_signature, scheduled_for, created_at, ai_estimate';

export type PublicJob = Pick<
  JobRow,
  'id' | 'status' | 'customer_name' | 'address' | 'city' | 'state' | 'zip' | 'service' | 'description' | 'estimate_low_cents' | 'estimate_high_cents' | 'quote_cents' | 'quote_details' | 'quote_sent_at' | 'approved_at' | 'approved_signature' | 'scheduled_for' | 'created_at'
> & { scope: { title: string; description: string }[]; assumptions: string[]; exclusions: string[] };

/** Strip the contractor-only parts (payout targets, risk notes) out of the AI estimate. */
export function toPublicJob(row: Omit<PublicJob, 'scope' | 'assumptions' | 'exclusions'> & { ai_estimate: unknown }): PublicJob {
  const est = (row.ai_estimate ?? {}) as { scope?: { title: string; description: string }[]; assumptions?: string[]; exclusions?: string[] };
  const { ai_estimate: _omit, ...rest } = row;
  return {
    ...rest,
    scope: (est.scope ?? []).map(({ title, description }) => ({ title, description })),
    assumptions: est.assumptions ?? [],
    exclusions: est.exclusions ?? [],
  };
}

export function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}
export const centsToMoney = (cents: number | null | undefined) => (cents == null ? '—' : money(cents / 100));

export const fullAddress = (j: { address: string; city: string; state: string; zip: string }) => `${j.address}, ${j.city}, ${j.state} ${j.zip}`;
