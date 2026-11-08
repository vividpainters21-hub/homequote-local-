import { redirect } from 'next/navigation';

// The old browser-only dashboard was replaced by /admin (contractor) and /p/<link> (customers).
export default function Page() {
  redirect('/admin');
}
