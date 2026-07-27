import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const schema = z.object({ filename: z.string().min(1), contentType: z.string().min(1) });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid upload request' }, { status: 400 });
  const safeName = parsed.data.filename.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${auth.user.id}/${crypto.randomUUID()}-${safeName}`;
  const { data, error } = await supabase.storage.from('project-photos').createSignedUploadUrl(path);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ path, token: data.token, signedUrl: data.signedUrl });
}
