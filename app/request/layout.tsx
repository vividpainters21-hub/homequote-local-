import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Get a Free Painting & Remodeling Estimate',
  description: 'Start a preliminary estimate for interior painting, exterior painting, drywall, flooring, bathroom remodeling or basement waterproofing in Schenectady, NY.',
  alternates: { canonical: '/request' },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
