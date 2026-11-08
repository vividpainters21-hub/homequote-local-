import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client. It bypasses row-level security, so it must only run on the
 * server, and every caller must check the job's public token (or the admin role) first.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set on the server.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
