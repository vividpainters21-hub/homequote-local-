import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const projectSchema = z.object({
  address: z.string().min(2), city: z.string().min(2), state: z.string().length(2), postalCode: z.string().regex(/^\d{5}$/),
  service: z.string().min(2), description: z.string().min(10), answers: z.record(z.unknown()).default({}), estimate: z.record(z.unknown()),
  customerPriceLow: z.number().nonnegative(), customerPriceHigh: z.number().nonnegative(), contractorPayoutLow: z.number().nonnegative(), contractorPayoutHigh: z.number().nonnegative(),
});

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabase.from('project_requests').select('*, properties(*), estimates(*)').eq('homeowner_id', auth.user.id).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Sign in before saving a project.' }, { status: 401 });
  const parsed = projectSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;

  const { data: property, error: propertyError } = await supabase.from('properties').insert({ homeowner_id: auth.user.id, address: input.address, city: input.city, state: input.state, zip: input.postalCode }).select().single();
  if (propertyError) return NextResponse.json({ error: propertyError.message }, { status: 400 });
  const { data: project, error: projectError } = await supabase.from('project_requests').insert({ homeowner_id: auth.user.id, property_id: property.id, service: input.service, description: input.description, status: 'ai_generated', answers: input.answers }).select().single();
  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 400 });
  const { error: estimateError } = await supabase.from('estimates').insert({ project_request_id: project.id, ai_output: input.estimate, customer_price_low_cents: Math.round(input.customerPriceLow * 100), customer_price_high_cents: Math.round(input.customerPriceHigh * 100), contractor_payout_low_cents: Math.round(input.contractorPayoutLow * 100), contractor_payout_high_cents: Math.round(input.contractorPayoutHigh * 100), status: 'ai_generated' });
  if (estimateError) return NextResponse.json({ error: estimateError.message }, { status: 400 });
  return NextResponse.json({ id: project.id }, { status: 201 });
}
