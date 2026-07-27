import Link from 'next/link';

export function Nav() {
  return (
    <header className="site-header">
      <div className="wrap nav">
        <Link href="/" className="brand" aria-label="HomeQuote Local home">
          HomeQuote <span>Local</span>
        </Link>
        <nav className="links" aria-label="Primary navigation">
          <Link href="/#services">Services</Link>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/contractor">For contractors</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/login">Sign in</Link>
          <Link className="btn" href="/request">Start an estimate</Link>
        </nav>
      </div>
    </header>
  );
}
