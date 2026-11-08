import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';

const MAX_PHOTOS = 8;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

const Schema = z.object({
  files: z.array(z.object({ name: z.string().min(1).max(200), type: z.string(), size: z.number().positive().max(8 * 1024 * 1024) })).min(1).max(MAX_PHOTOS),
});

/** Customer photo upload: returns one-time signed upload URLs for the job's private folder. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{36}$/.test(token)) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  if (!rateLimit(request, 'uploads', 10, 10 * 60 * 1000).ok) return NextResponse.json({ error: 'Too many uploads. Please wait a few minutes.' }, { status: 429 });

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Files must be photos or PDFs under 8 MB, up to 8 at a time.' }, { status: 400 });
  if (parsed.data.files.some((f) => !ALLOWED.includes(f.type))) return NextResponse.json({ error: 'Only JPG, PNG, WEBP, HEIC photos and PDFs are allowed.' }, { status: 400 });

  const db = createAdminClient();
  const { data: job } = await db.from('jobs').select('id').eq('public_token', token).single();
  if (!job) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  const { count } = await db.from('job_photos').select('id', { count: 'exact', head: true }).eq('job_id', job.id);
  if ((count ?? 0) + parsed.data.files.length > MAX_PHOTOS) return NextResponse.json({ error: `A project can have up to ${MAX_PHOTOS} files.` }, { status: 400 });

  const uploads = [];
  for (const file of parsed.data.files) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100);
    const path = `${job.id}/${crypto.randomUUID()}-${safeName}`;
    const { data, error } = await db.storage.from('job-photos').createSignedUploadUrl(path);
    if (error) return NextResponse.json({ error: 'Upload could not be prepared.' }, { status: 500 });
    await db.from('job_photos').insert({ job_id: job.id, storage_path: path, original_name: file.name, content_type: file.type });
    uploads.push({ name: file.name, path, token: data.token });
  }
  return NextResponse.json({ uploads });
}
