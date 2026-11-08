'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Nav } from '@/components/Nav';
import { US_STATES, validZip } from '@/lib/location';
import { SERVICES as services } from '@/lib/jobs';
import { uploadJobPhotos } from '@/lib/upload';

export default function RequestPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const [statusText, setStatusText] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [form, setForm] = useState({
    address: '', city: '', state: 'NY', postalCode: '', service: 'Interior Painting', description: '', squareFeet: '', linearFeet: '', rooms: '',
    condition: 'Normal condition', materialsBy: 'Homeowner supplies finish materials', timeline: 'Within 2–4 weeks',
    name: '', email: '', phone: '',
  });

  const progress = useMemo(() => `${Math.round(step / 3 * 100)}%`, [step]);
  const previews = useMemo(() => photos.filter((file) => file.type.startsWith('image/')).map((file) => ({ name: file.name, url: URL.createObjectURL(file) })), [photos]);
  const update = (name: string, value: string) => setForm((current) => ({ ...current, [name]: value }));

  function selectPhotos(files: FileList | null) {
    if (!files) return;
    const next = Array.from(files).slice(0, 8);
    const tooLarge = next.find((file) => file.size > 8 * 1024 * 1024);
    if (tooLarge) {
      setError(`${tooLarge.name} is larger than 8 MB.`);
      return;
    }
    setError('');
    setPhotos(next);
  }

  async function generate() {
    if (!form.description.trim() || !form.name.trim() || !form.email.trim()) {
      setError('Add the project description, your name and your email before continuing.');
      return;
    }
    if (!form.city.trim() || !form.state || !validZip(form.postalCode)) {
      setError('Enter a city, state and valid 5-digit ZIP code.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, website: honeypot }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'We could not save your request.');
      if (photos.length) {
        setStatusText('Uploading photos…');
        await uploadJobPhotos(data.token, photos);
      }
      router.push(`/p/${data.token}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not save your request.');
      setLoading(false);
      setStatusText('');
    }
  }

  return <><Nav /><main className="wrap section request-layout">
    <section className="wizard card">
      <div className="wizard-head"><div><span className="eyebrow">Preliminary estimate</span><h1>Tell us about your project</h1></div><span className="step-count">Step {step} of 3</span></div>
      <div className="progress"><span style={{ width: progress }} /></div>

      {step === 1 && <div className="form-grid">
        <label className="full">Street address<input value={form.address} onChange={(event) => update('address', event.target.value)} placeholder="123 Main Street" /></label><label>City<input value={form.city} onChange={(event) => update('city', event.target.value)} placeholder="City" /></label><label>State<select value={form.state} onChange={(event) => update('state', event.target.value)}>{US_STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label><label>ZIP code<input inputMode="numeric" maxLength={5} value={form.postalCode} onChange={(event) => update('postalCode', event.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="12345" /></label>
        <label className="full">Service<select value={form.service} onChange={(event) => update('service', event.target.value)}>{services.map((service) => <option key={service}>{service}</option>)}</select></label>
        <label>Approximate square feet<input type="number" min="1" value={form.squareFeet} onChange={(event) => update('squareFeet', event.target.value)} placeholder="Example: 850" /></label>
        <label>Linear feet, when relevant<input type="number" min="1" value={form.linearFeet} onChange={(event) => update('linearFeet', event.target.value)} placeholder="Example: 63" /></label>
        <label>Number of rooms<input type="number" min="1" value={form.rooms} onChange={(event) => update('rooms', event.target.value)} placeholder="Example: 3" /></label>
        <label>Current condition<select value={form.condition} onChange={(event) => update('condition', event.target.value)}><option>Normal condition</option><option>Moderate repairs</option><option>Major repairs or difficult access</option></select></label>
      </div>}

      {step === 2 && <div className="form-grid">
        <label className="full">Describe the work<textarea value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Describe the rooms or area, current condition, demolition, repairs, desired finish, access and anything else we should know." /></label>
        <label>Who supplies finish materials?<select value={form.materialsBy} onChange={(event) => update('materialsBy', event.target.value)}><option>Homeowner supplies finish materials</option><option>Contractor supplies materials</option><option>Not sure yet</option></select></label>
        <label>Preferred timeline<select value={form.timeline} onChange={(event) => update('timeline', event.target.value)}><option>As soon as possible</option><option>Within 2–4 weeks</option><option>Within 1–3 months</option><option>Flexible</option></select></label>
        <div className="upload-box full"><b>Project photos or documents</b><p>Add up to eight files. Photos help us quote accurately. You can also add more later from your project page.</p><label className="btn secondary upload-button">Choose files<input hidden type="file" multiple accept="image/*,.pdf" onChange={(event) => selectPhotos(event.target.files)} /></label>{photos.length > 0 && <><p><b>{photos.length} file{photos.length === 1 ? '' : 's'} selected</b></p><div className="photo-grid">{previews.map((preview) => <figure key={preview.name}><img src={preview.url} alt={preview.name} /><figcaption>{preview.name}</figcaption></figure>)}</div></>}</div>
      </div>}

      {step === 3 && <div className="form-grid">
        <label>Full name<input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Your name" /></label>
        <label>Email<input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="you@example.com" /></label>
        <label>Phone<input value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="(518) 555-0123" /></label>
        <div className="summary-box full"><h3>Review</h3><p><b>{form.service}</b> at {[form.address, form.city, form.state, form.postalCode].filter(Boolean).join(', ') || 'address not entered'}</p><p className="muted">{form.description || 'Project description not entered.'}</p><p>{photos.length} attachment{photos.length === 1 ? '' : 's'}</p></div>
        <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} name="website" />
        <p className="fine-print full">By continuing, you understand this is an AI-assisted preliminary estimate—not a contract or guaranteed price. Final pricing can change after inspection, measurements, permit review, material choices and hidden conditions.</p>
      </div>}


      {error && <p className="error">{error}</p>}
      <div className="wizard-actions">{step > 1 && <button className="btn secondary" onClick={() => setStep(step - 1)}>Back</button>}<span />{step < 3 && <button className="btn" onClick={() => { if (step === 1 && (!form.address.trim() || !form.city.trim() || !validZip(form.postalCode))) { setError('Enter the street address, city and valid 5-digit ZIP code first.'); return; } setError(''); setStep(step + 1); }}>Continue</button>}{step === 3 && <button className="btn" disabled={loading} onClick={generate}>{loading ? (statusText || 'Creating your estimate…') : 'Get my estimate'}</button>}</div>
    </section>
    <aside className="card request-aside"><span className="eyebrow">What happens next</span><h2>A better starting point before the site visit.</h2><div className="aside-item"><b>1</b><p><strong>AI-assisted scope</strong><br />We organize the submitted work into clear line items.</p></div><div className="aside-item"><b>2</b><p><strong>Pricing range</strong><br />The system combines measurements, service rules and project difficulty.</p></div><div className="aside-item"><b>3</b><p><strong>Your project page</strong><br />You get a private link to see your quote, approve it, message us and track the job.</p></div></aside>
  </main></>;
}
