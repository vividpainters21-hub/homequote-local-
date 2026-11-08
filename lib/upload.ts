'use client';

import { createClient } from '@/lib/supabase/client';

/** Upload customer files straight to private storage using one-time signed URLs from the server. */
export async function uploadJobPhotos(token: string, files: File[]): Promise<{ uploaded: number; error?: string }> {
  const tooBig = files.find((f) => f.size > 8 * 1024 * 1024);
  if (tooBig) return { uploaded: 0, error: `${tooBig.name} is larger than 8 MB.` };
  try {
    const res = await fetch(`/api/p/${token}/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: files.map((f) => ({ name: f.name, type: f.type || 'application/octet-stream', size: f.size })) }),
    });
    const data = await res.json();
    if (!res.ok) return { uploaded: 0, error: data.error || 'Upload failed.' };
    const storage = createClient().storage.from('job-photos');
    let uploaded = 0;
    for (const [i, u] of (data.uploads as { path: string; token: string }[]).entries()) {
      const { error } = await storage.uploadToSignedUrl(u.path, u.token, files[i], { contentType: files[i].type });
      if (!error) uploaded++;
    }
    return uploaded === files.length ? { uploaded } : { uploaded, error: `${files.length - uploaded} file(s) did not upload. Please try again.` };
  } catch {
    return { uploaded: 0, error: 'Upload failed. Check your connection and try again.' };
  }
}
