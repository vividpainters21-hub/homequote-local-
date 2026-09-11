import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'VividPro Painters & Remodeling | Schenectady, NY Painting Estimates',
    template: '%s | VividPro Painters & Remodeling',
  },
  description: 'VividPro Painters & Remodeling provides AI-assisted preliminary estimates for interior and exterior painting, drywall and remodeling in Schenectady, NY and the Capital Region (ZIP codes 12302-12309).',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
