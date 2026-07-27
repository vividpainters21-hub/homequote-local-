import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'HomeQuote Local | AI-Assisted Home Project Estimates',
  description: 'Plan a home project, receive an AI-assisted preliminary estimate, and connect with local contractors around Serving all 50 states and Washington, D.C..',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
