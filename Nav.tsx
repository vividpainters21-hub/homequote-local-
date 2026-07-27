export type Contractor = {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  postalCodes: string[];
  radiusMiles: number;
  nationwide: boolean;
  services: string[];
  rating: number;
  completedJobs: number;
  verified: boolean;
  availability: 'Available' | 'Limited' | 'Unavailable';
};

export const demoContractors: Contractor[] = [
  {
    id: 'contractor-vividpro', businessName: 'VividPro Painters & Remodeling', contactName: 'Ajay',
    email: 'contractor@example.com', phone: '(518) 555-0148', city: 'Schenectady', state: 'NY',
    postalCodes: ['12302','12303','12304','12305','12306','12307','12308','12309'], radiusMiles: 30, nationwide: false,
    services: ['Interior Painting','Exterior Painting','Drywall','Flooring','Bathroom Remodeling','Basement Waterproofing','General Remodeling'],
    rating: 4.9, completedJobs: 47, verified: true, availability: 'Available',
  },
  {
    id: 'contractor-national-remodel', businessName: 'HomeQuote National Pro Network', contactName: 'Marketplace Team',
    email: 'network@example.com', phone: '(800) 555-0190', city: 'Nationwide', state: 'US', postalCodes: [], radiusMiles: 0, nationwide: true,
    services: ['Interior Painting','Exterior Painting','Drywall','Flooring','Bathroom Remodeling','Basement Waterproofing','General Remodeling'],
    rating: 4.8, completedJobs: 284, verified: true, availability: 'Available',
  },
  {
    id: 'contractor-capital-tile', businessName: 'Capital Tile & Bath', contactName: 'Demo Contractor',
    email: 'tile@example.com', phone: '(518) 555-0182', city: 'Albany', state: 'NY', postalCodes: ['12203','12205','12206','12208'], radiusMiles: 25, nationwide: false,
    services: ['Bathroom Remodeling','Flooring'], rating: 4.7, completedJobs: 31, verified: true, availability: 'Limited',
  },
];

export function contractorMatches(service: string, state?: string, postalCode?: string) {
  return demoContractors
    .filter((contractor) => {
      if (!contractor.verified || !contractor.services.includes(service) || contractor.availability === 'Unavailable') return false;
      if (contractor.nationwide) return true;
      if (state && contractor.state !== state) return false;
      if (postalCode && contractor.postalCodes.length && !contractor.postalCodes.includes(postalCode)) return false;
      return true;
    })
    .sort((a, b) => {
      const localA = Number(!a.nationwide && (!state || a.state === state));
      const localB = Number(!b.nationwide && (!state || b.state === state));
      if (localA !== localB) return localB - localA;
      const availability = Number(b.availability === 'Available') - Number(a.availability === 'Available');
      if (availability !== 0) return availability;
      return b.rating - a.rating;
    });
}
