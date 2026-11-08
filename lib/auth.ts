import 'server-only';
import { createClient } from '@/lib/supabase/server';

/** Returns the signed-in contractor's Supabase client, or null if the user is not an admin. */
export async function getAdmin() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', auth.user.id).single();
  if (!profile || !['admin', 'project_manager'].includes(profile.role)) return null;
  return { supabase, user: auth.user, name: profile.full_name as string | null };
}
