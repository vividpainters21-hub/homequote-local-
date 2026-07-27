'use client';

import { useMemo, useState } from 'react';
import { Nav } from '@/components/Nav';
import type { Estimate } from '@/lib/estimate';
import { money, saveProject, type ProjectRecord } from '@/lib/project';
import { US_STATES, validZip } from '@/lib/location';

const services = ['Interior Painting', 'Exterior Painting', 'Drywall', 'Flooring', 'Bathroom Remodeling', 'Basement Waterproofing', 'General Remodeling'];

export default function RequestPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Estimate | null>(null);
  const [savedId, setSavedId] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [form, setForm] = useState({
    address: '', city: '', state: 'NY', postalCode: '', service: 'Interior Painting', description: '', squareFeet: '', linearFeet: '', rooms: '',
    condition: 'Normal condition', materialsBy: 'Homeowner supplies finish materials', timeline: 'Within 2–4 weeks',
    name: '', email: '', phone: '',
  });

  const progress = useMemo(() => `${Math.round(step / 4 * 100)}%`, [step]);
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
      setError('Add the project description, your name and your email before generating the estimate.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (!form.city.trim() || !form.state || !validZip(form.postalCode)) {
        setError('Enter a city, state and valid 5-digit ZIP code.');
        setLoading(false);
        return;
      }
      const payload = {
        ...form,
        squareFeet: Number(form.squareFeet) || undefined,
        linearFeet: Number(form.linearFeet) || undefined,
        rooms: Number(form.rooms) || undefined,
        photoNames: photos.map((file) => file.name),
      };
      const response = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Estimate failed');
      const estimate = data as Estimate;
      const now = new Date().toISOString();
      const id = globalThis.crypto?.randomUUID?.() || `project-${Date.now()}`;
      const record: ProjectRecord = {
        id, createdAt: now, updatedAt: now, status: 'AI generated',
        address: form.address, city: form.city, state: form.state, postalCode: form.postalCode, service: form.service, description: form.description,
        squareFeet: payload.squareFeet, linearFeet: payload.linearFeet, rooms: payload.rooms,
        condition: form.condition, materialsBy: form.materialsBy, timeline: form.timeline,
        homeowner: { name: form.name, email: form.email, phone: form.phone },
        photoNames: payload.photoNames, estimate,
      };
      saveProject(record);

      // Save to Supabase when the homeowner is signed in. The browser copy remains
      // available as an offline/demo fallback when the production database is not configured.
      let finalId = id;
      try {
        const cloudResponse = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: form.address, city: form.city, state: form.state, postalCode: form.postalCode,
            service: form.service, description: form.description,
            answers: {
              squareFeet: payload.squareFeet, linearFeet: payload.linearFeet, rooms: payload.rooms,
              condition: form.condition, materialsBy: form.materialsBy, timeline: form.timeline,
              photoNames: payload.photoNames,
            },
            estimate,
            customerPriceLow: estimate.customerPriceLow, customerPriceHigh: estimate.customerPriceHigh,
            contractorPayoutLow: estimate.contractorPayoutLow, contractorPayoutHigh: estimate.contractorPayoutHigh,
          }),
        });
        if (cloudResponse.ok) {
          const cloudProject = await cloudResponse.json();
          finalId = cloudProject.id || id;
        }
      } catch {
        // Keep the local project if the network or Supabase is unavailable.
      }

      setSavedId(finalId);
      setResult(estimate);
      setStep(4);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Estimate failed');
    } finally {
      setLoading(false);
    }
  }

  return <><Nav /><main className="wrap section request-layout">
    <section className="wizard card">
      <div className="wizard-head"><div><span className="eyebrow">Preliminary estimate</span><h1>Tell us about your project</h1></div><span className="step-count">Step {step} of 4</span></div>
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
        <label>Who supplies finish materials?<select value={form.materialsBy} onChange={(event) => update('materialsBy', event.target.value)}><option>Homeowner supplies finish materials</option><option>Platform supplies materials</option><option>Not sure yet</option></select></label>
        <label>Preferred timeline<select value={form.timeline} onChange={(event) => update('timeline', event.target.value)}><option>As soon as possible</option><option>Within 2–4 weeks</option><option>Within 1–3 months</option><option>Flexible</option></select></label>
        <div className="upload-box full"><b>Project photos or documents</b><p>Add up to eight files. In this working preview the filenames are saved with the estimate; Supabase will provide permanent cloud storage in the production version.</p><label className="btn secondary upload-button">Choose files<input hidden type="file" multiple accept="image/*,.pdf" onChange={(event) => selectPhotos(event.target.files)} /></label>{photos.length > 0 && <><p><b>{photos.length} file{photos.length === 1 ? '' : 's'} selected</b></p><div className="photo-grid">{previews.map((preview) => <figure key={preview.name}><img src={preview.url} alt={preview.name} /><figcaption>{preview.name}</figcaption></figure>)}</div></>}</div>
      </div>}

      {step === 3 && <div className="form-grid">
        <label>Full name<input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Your name" /></label>
        <label>Email<input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="you@example.com" /></label>
        <label>Phone<input value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="(518) 555-0123" /></label>
        <div className="summary-box full"><h3>Review</h3><p><b>{form.service}</b> at {[form.address, form.city, form.state, form.postalCode].filter(Boolean).join(', ') || 'address not entered'}</p><p className="muted">{form.description || 'Project description not entered.'}</p><p>{photos.length} attachment{photos.length === 1 ? '' : 's'}</p></div>
        <p className="fine-print full">By continuing, you understand this is an AI-assisted preliminary estimate—not a contract or guaranteed price. Final pricing can change after inspection, measurements, permit review, material choices and hidden conditions.</p>
      </div>}

      {step === 4 && result && <div className="result">
        <div className="success-banner"><b>Estimate saved.</b> Project reference: {savedId.slice(0, 8).toUpperCase()}</div>
        <div className="result-hero"><div><span className="status">Human review required</span><h2>{result.projectSummary}</h2><p>{result.inspectionReason}</p></div><div className="result-price"><span>Preliminary range</span><strong>{money(result.customerPriceLow)}–{money(result.customerPriceHigh)}</strong><small>{result.durationDaysLow}–{result.durationDaysHigh} estimated workdays</small></div></div>
        <h3>Proposed scope</h3><div className="scope-list">{result.scope.map((scope, index) => <div key={`${scope.title}-${index}`}><span>{index + 1}</span><div><b>{scope.title}</b><p>{scope.description}</p></div></div>)}</div>
        <div className="result-columns"><div><h3>Assumptions</h3><ul>{result.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h3>Not included</h3><ul>{result.exclusions.map((item) => <li key={item}>{item}</li>)}</ul></div></div>
        <div className="alert"><b>Next step:</b> Open the homeowner dashboard to see the saved request, or use the admin dashboard to approve it and begin contractor matching.</div>
        <div className="inline-actions"><a className="btn" href="/dashboard">Homeowner dashboard</a><a className="btn secondary" href="/admin">Admin review</a></div>
      </div>}

      {error && <p className="error">{error}</p>}
      <div className="wizard-actions">{step > 1 && step < 4 && <button className="btn secondary" onClick={() => setStep(step - 1)}>Back</button>}<span />{step < 3 && <button className="btn" onClick={() => { if (step === 1 && (!form.address.trim() || !form.city.trim() || !validZip(form.postalCode))) { setError('Enter the street address, city and valid 5-digit ZIP code first.'); return; } setError(''); setStep(step + 1); }}>Continue</button>}{step === 3 && <button className="btn" disabled={loading} onClick={generate}>{loading ? 'Creating estimate…' : 'Generate and save estimate'}</button>}{step === 4 && <button className="btn secondary" onClick={() => { setResult(null); setSavedId(''); setPhotos([]); setStep(1); }}>Start another</button>}</div>
    </section>
    <aside className="card request-aside"><span className="eyebrow">What happens next</span><h2>A better starting point before the site visit.</h2><div className="aside-item"><b>1</b><p><strong>AI-assisted scope</strong><br />We organize the submitted work into clear line items.</p></div><div className="aside-item"><b>2</b><p><strong>Pricing range</strong><br />The system combines measurements, service rules and project difficulty.</p></div><div className="aside-item"><b>3</b><p><strong>Local review</strong><br />A reviewer confirms the estimate and matches qualified contractors based on service, state and ZIP coverage.</p></div></aside>
  </main></>;
}
