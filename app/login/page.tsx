'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Nav } from '@/components/Nav';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setMessage('');
    try {
      const { error } = await createClient().auth.signInWithPassword({ email, password });
      if (error) throw error;
      const next = new URLSearchParams(window.location.search).get('next');
      router.push(next && next.startsWith('/') && !next.startsWith('//') ? next : '/admin'); router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally { setLoading(false); }
  }

  return <><Nav /><main className="wrap section auth-wrap"><form className="card auth-card" onSubmit={submit}><span className="eyebrow">Welcome back</span><h1>Sign in</h1><label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>Password<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></label>{message && <p className="error">{message}</p>}<button className="btn" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button><p className="muted">No account? <a href="/signup">Create one</a></p></form></main></>;
}
