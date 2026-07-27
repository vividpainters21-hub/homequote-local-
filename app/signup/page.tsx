'use client';

import { FormEvent, useState } from 'react';
import { Nav } from '@/components/Nav';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'homeowner' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setMessage('');
    try {
      const { error } = await createClient().auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.name, phone: form.phone, role: form.role } },
      });
      if (error) throw error;
      setMessage('Account created. Check your email to confirm it, then sign in.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create account.');
    } finally { setLoading(false); }
  }

  return <><Nav /><main className="wrap section auth-wrap"><form className="card auth-card" onSubmit={submit}><span className="eyebrow">Join HomeQuote Local</span><h1>Create your account</h1><label>Full name<input required value={form.name} onChange={(e) => update('name', e.target.value)} /></label><label>Email<input type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} /></label><label>Phone<input value={form.phone} onChange={(e) => update('phone', e.target.value)} /></label><label>Account type<select value={form.role} onChange={(e) => update('role', e.target.value)}><option value="homeowner">Homeowner</option><option value="contractor">Contractor</option></select></label><label>Password<input type="password" minLength={8} required value={form.password} onChange={(e) => update('password', e.target.value)} /></label>{message && <p className={message.startsWith('Account') ? 'success-banner' : 'error'}>{message}</p>}<button className="btn" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button><p className="muted">Already registered? <a href="/login">Sign in</a></p></form></main></>;
}
