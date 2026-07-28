import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const leadSchema = z.object({
  customer_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().default(''),
  project_type: z.string().min(1),
  project_details: z.record(z.string(), z.unknown()).default({}),
  estimate_min: z.number().nonnegative(),
  estimate_max: z.number().nonnegative(),
});

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = leadSchema.safeParse(await request.json());
  } catch (error) {
    console.error('[estimate-lead] Invalid JSON body', error);
    return NextResponse.json(
      { error: 'We could not read the submitted estimate.' },
      { status: 400 }
    );
  }

  if (!parsed.success) {
    console.error('[estimate-lead] Validation failed', parsed.error.flatten());
    return NextResponse.json(
      { error: 'Some required estimate details were missing.' },
      { status: 400 }
    );
  }

  const input = parsed.data;

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('estimates')
      .insert({
        customer_name: input.customer_name,
        email: input.email,
        phone: input.phone,
        project_type: input.project_type,
        project_details: input.project_details,
        estimate_min: input.estimate_min,
        estimate_max: input.estimate_max,
        status: 'new',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[estimate-lead] Supabase insert failed:', error);

      return NextResponse.json(
        {
          error:
            'We generated your estimate, but saving it failed. Our team can still follow up if you email or call us directly.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    console.error(
      '[estimate-lead] Unexpected error saving estimate:',
      error
    );

    return NextResponse.json(
      {
        error:
          'We generated your estimate, but saving it failed. Our team can still follow up if you email or call us directly.',
      },
      { status: 500 }
    );
  }
}
