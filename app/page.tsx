import Link from 'next/link';
import { Nav } from '@/components/Nav';

const services = [
  ['Interior & exterior painting', 'Room-by-room scopes, prep, coats, trim and material allowances.'],
  ['Drywall', 'Repairs, replacement, taping, finishing and optional painting.'],
  ['Flooring', 'LVP, hardwood and tile installation with removal and prep.'],
  ['Bathroom remodeling', 'Guided planning for showers, tile, vanities, toilets and finishes.'],
  ['Basement waterproofing', 'Drainage, sump pumps, wall protection and crawl-space solutions.'],
  ['General remodeling', 'Submit a custom project for review and a firm quote.'],
];

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <section className="wrap hero">
          <div>
            <span className="badge">Available across the United States</span>
            <h1>Get a faster home-project estimate.</h1>
            <p>
              Tell us what you need, add measurements and photos, and receive an AI-assisted preliminary estimate reviewed before it becomes a final quote.
            </p>
            <div className="actions">
              <Link className="btn" href="/request">Start my estimate</Link>
              <Link className="btn secondary" href="/#how-it-works">How it works</Link>
            </div>
            <div className="trust-row">
              <span>✓ Instant estimate</span><span>✓ Approve your quote online</span><span>✓ Track your job and message us</span>
            </div>
          </div>
          <div className="estimate-card card">
            <div className="estimate-top"><span className="eyebrow">Example estimate</span><span className="status">Preliminary</span></div>
            <h2>Paint three bedrooms</h2>
            <p className="muted">Walls, ceilings, trim and minor repairs in an occupied home.</p>
            <div className="price-block"><span>Estimated range</span><strong>$3,200–$4,100</strong></div>
            <div className="mini-grid"><div><b>3–5</b><span>workdays</span></div><div><b>4</b><span>scope items</span></div><div><b>Local</b><span>crew</span></div></div>
            <p className="fine-print">Final pricing requires review, measurements and verification of site conditions.</p>
          </div>
        </section>

        <section id="services" className="wrap section">
          <div className="section-heading"><span className="eyebrow">Services</span><h2>Start with the work you need</h2><p>Each service uses a different guided estimate flow.</p></div>
          <div className="grid service-grid">{services.map(([title, text]) => <article className="card service-card" key={title}><div className="service-icon">⌂</div><h3>{title}</h3><p className="muted">{text}</p><Link href="/request">Get started →</Link></article>)}</div>
        </section>

        <section id="how-it-works" className="section soft-section">
          <div className="wrap"><div className="section-heading"><span className="eyebrow">How it works</span><h2>From request to finished job, in one place</h2></div>
            <div className="grid steps">
              <div className="step"><b>1</b><h3>Describe the project</h3><p>Add the property, service, measurements, timing and project details.</p></div>
              <div className="step"><b>2</b><h3>Receive a preliminary estimate</h3><p>Our estimating system creates a scope, price range, assumptions and risks.</p></div>
              <div className="step"><b>3</b><h3>Approve and track</h3><p>Get your final quote on your private project page, approve it online, pick a start date and message us any time.</p></div>
            </div>
          </div>
        </section>

        <section className="wrap section cta"><div><span className="eyebrow">Ready to plan the job?</span><h2>Build your first estimate in minutes.</h2></div><Link className="btn" href="/request">Start my estimate</Link></section>
      </main>
      <footer><div className="wrap footer-inner"><b>HomeQuote Local</b><span>Serving all 50 states and Washington, D.C.</span><span>Preliminary estimates require review.</span></div></footer>
    </>
  );
}
