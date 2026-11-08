'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { centsToMoney } from '@/lib/jobs';
import { uploadJobPhotos } from '@/lib/upload';

type Props = { token: string } & ({ mode: 'approve'; quoteCents: number; depositPercent: number } | { mode: 'message' } | { mode: 'photos' } | { mode: 'pay'; kind: 'deposit' | 'balance'; amountCents: number; label: string });

export function PortalActions(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [text, setText] = useState('');
  const [agree, setAgree] = useState(false);

  async function post(payload: Record<string, unknown>) {
    setBusy(true); setError(''); setNotice('');
    try {
      const res = await fetch(`/api/p/${props.token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      setText('');
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (props.mode === 'approve') {
    return (
      <form className="approve-box" onSubmit={(e) => { e.preventDefault(); post({ action: 'approve', signature: text, agree, quoteCents: props.quoteCents }); }}>
        <h3>Approve this quote</h3>
        <label>Type your full name to sign<input required minLength={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Full name" autoComplete="name" /></label>
        <label className="check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} required /> I approve the work described above for {centsToMoney(props.quoteCents)}{props.depositPercent > 0 ? `, with a ${props.depositPercent}% deposit` : ''}.</label>
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy || !agree || text.trim().length < 2}>{busy ? 'Approving…' : 'Approve and sign'}</button>
      </form>
    );
  }

  if (props.mode === 'pay') {
    const { kind, amountCents, label } = props;
    return (
      <div className="pay-box">
        <button className="btn" disabled={busy} onClick={async () => {
          setBusy(true); setError('');
          try {
            const res = await fetch(`/api/p/${props.token}/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind }) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.url) throw new Error(data.error || 'Payment could not be started.');
            window.location.href = data.url;
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Payment could not be started.');
            setBusy(false);
          }
        }}>{busy ? 'Opening secure checkout…' : `${label}: ${centsToMoney(amountCents)}`}</button>
        <small className="muted">Secure payment by Stripe. Card, Apple Pay or Google Pay.</small>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  if (props.mode === 'message') {
    return (
      <form className="message-form" onSubmit={(e) => { e.preventDefault(); if (text.trim()) post({ action: 'message', body: text }); }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message…" maxLength={4000} />
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy || !text.trim()}>{busy ? 'Sending…' : 'Send message'}</button>
      </form>
    );
  }

  return (
    <div>
      <label className="btn secondary upload-button">
        {busy ? 'Uploading…' : 'Add photos'}
        <input hidden type="file" multiple accept="image/*,.pdf" disabled={busy} onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (!files.length) return;
          setBusy(true); setError(''); setNotice('');
          const result = await uploadJobPhotos(props.token, files);
          setBusy(false);
          if (result.error) setError(result.error);
          else setNotice(`${result.uploaded} file${result.uploaded === 1 ? '' : 's'} uploaded. Thank you!`);
        }} />
      </label>
      {notice && <p className="success-banner">{notice}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
