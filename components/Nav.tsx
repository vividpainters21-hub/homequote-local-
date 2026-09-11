import Link from 'next/link';

const phone = process.env.NEXT_PUBLIC_BUSINESS_PHONE || '';

export function Nav() {
  return (
    <header className="site-header">
      <div className="wrap nav">
        <Link href="/" className="brand" aria-label="VividPro Painters & Remodeling home">
          VividPro <span>Painters</span>
        </Link>
        <nav className="links" aria-label="Primary navigation">
          <Link href="/#services">Services</Link>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/login">Sign in</Link>
          {phone && <a href={`tel:${phone.replace(/[^0-9+]/g, '')}`}>{phone}</a>}
          <Link className="btn" href="/request">Start an estimate</Link>
        </nav>
      </div>
    </header>
  );
}
