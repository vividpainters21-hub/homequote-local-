import Link from 'next/link';
import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';

export const metadata: Metadata = {
  title: 'Painting & Remodeling Estimates in Schenectady, NY',
  description: 'Request a fast preliminary estimate for interior painting, exterior painting, drywall or remodeling from VividPro Painters & Remodeling, serving Schenectady, NY and the Capital Region.',
  alternates: { canonical: '/' },
};

const services = [
  ['Interior painting', 'Room-by-room scopes, prep, coats, trim and material allowances.'],
  ['Exterior painting', 'Siding, trim and exterior surfaces prepared and finished for our Capital Region weather.'],
  ['Drywall', 'Repairs, replacement, taping, finishing and optional painting.'],
  ['Flooring', 'LVP, hardwood and tile installation with removal and prep.'],
  ['Bathroom remodeling', 'Guided planning for showers, tile, vanities, toilets and finishes.'],
  ['Basement waterproofing', 'Drainage, sump pumps, wall protection and crawl-space solutions.'],
];

const phone = process.env.NEXT_PUBLIC_BUSINESS_PHONE || '';
const serviceArea = 'Schenectady, NY';
const serviceZips = ['12302', '12303', '12304', '12305', '12306', '12307', '12308', '12309'];

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'HomeAndConstructionBusiness',
  name: 'VividPro Painters & Remodeling',
  description: 'Interior and exterior painting, drywall and remodeling contractor serving Schenectady, NY and the Capital Region.',
  areaServed: serviceZips.map((zip) => ({ '@type': 'PostalAddress', addressLocality: serviceArea, addressRegion: 'NY', postalCode: zip, addressCountry: 'US' })),
  ...(phone ? { telephone: phone } : {}),
  url: process.env.NEXT_PUBLIC_APP_URL || undefined,
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Nav />
      <main>
        <section className="wrap hero">
          <div>
            <span className="badge">Serving Schenectady, NY & the Capital Region</span>
            <h1>Get a fast painting &amp; remodeling estimate from a local Schenectady pro.</h1>
            <p>
              Tell us what you need, add measurements and photos, and receive an AI-assisted preliminary estimate that our team reviews before it becomes a final quote.
            </p>
            <div className="actions">
              <Link className="btn" href="/request">Start my estimate</Link>
              {phone && <a className="btn secondary" href={`tel:${phone.replace(/[^0-9+]/g, '')}`}>Call {phone}</a>}
            </div>
            <div className="trust-row">
              <span>✓ Human-reviewed pricing</span><span>✓ Based in Schenectady, NY</span><span>✓ Clear project scopes</span>
            </div>
          </div>
          <div className="estimate-card card">
            <div className="estimate-top"><span className="eyebrow">Example estimate</span><span className="status">Preliminary</span></div>
            <h2>Paint three bedrooms</h2>
            <p className="muted">Walls, ceilings, trim and minor repairs in an occupied home.</p>
            <div className="price-block"><span>Estimated range</span><strong>$3,200–$4,100</strong></div>
            <div className="mini-grid"><div><b>3–5</b><span>workdays</span></div><div><b>4</b><span>scope items</span></div><div><b>Local</b><span>Schenectady crew</span></div></div>
            <p className="fine-print">Final pricing requires review, measurements and verification of site conditions.</p>
          </div>
        </section>

        <section id="services" className="wrap section">
          <div className="section-heading"><span className="eyebrow">Services</span><h2>Start with the work you need</h2><p>Each service uses a different guided estimate flow.</p></div>
          <div className="grid service-grid">{services.map(([title, text]) => <article className="card service-card" key={title}><div className="service-icon">⌂</div><h3>{title}</h3><p className="muted">{text}</p><Link href="/request">Get started →</Link></article>)}</div>
        </section>

        <section id="how-it-works" className="section soft-section">
          <div className="wrap"><div className="section-heading"><span className="eyebrow">How it works</span><h2>From photos to a finished project</h2></div>
            <div className="grid steps">
              <div className="step"><b>1</b><h3>Describe the project</h3><p>Add the property, service, measurements, timing and project details.</p></div>
              <div className="step"><b>2</b><h3>Receive a preliminary estimate</h3><p>Our estimating system creates a scope, price range, assumptions and risks.</p></div>
              <div className="step"><b>3</b><h3>Confirm with our team</h3><p>A member of our Schenectady-based team reviews the estimate and schedules the work.</p></div>
            </div>
          </div>
        </section>

        <section className="wrap section cta"><div><span className="eyebrow">Ready to plan the job?</span><h2>Build your first estimate in minutes.</h2></div><Link className="btn" href="/request">Start my estimate</Link></section>
      </main>
      <footer><div className="wrap footer-inner"><b>VividPro Painters &amp; Remodeling</b><span>Serving Schenectady, NY and the Capital Region (ZIP codes 12302–12309)</span><span>Preliminary estimates require review.</span></div></footer>
    </>
  );
}
