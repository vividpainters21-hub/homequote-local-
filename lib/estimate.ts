import { z } from 'zod';

export const EstimateSchema = z.object({
  projectSummary: z.string().min(5),
  confidence: z.number().min(0).max(100),
  inspectionRequired: z.boolean(),
  inspectionReason: z.string(),
  scope: z.array(z.object({
    title: z.string(), description: z.string(), quantity: z.number().nonnegative(), unit: z.string(),
    laborLow: z.number().nonnegative(), laborHigh: z.number().nonnegative(),
    materialsLow: z.number().nonnegative(), materialsHigh: z.number().nonnegative(),
  })).min(1),
  assumptions: z.array(z.string()), exclusions: z.array(z.string()), riskFlags: z.array(z.string()),
  followUpQuestions: z.array(z.string()),
  customerPriceLow: z.number().nonnegative(), customerPriceHigh: z.number().nonnegative(),
  contractorPayoutLow: z.number().nonnegative(), contractorPayoutHigh: z.number().nonnegative(),
  durationDaysLow: z.number().positive(), durationDaysHigh: z.number().positive(),
  recommendedDepositPercent: z.number().min(0).max(100),
});
export type Estimate = z.infer<typeof EstimateSchema>;

type Input = {service:string;description:string;squareFeet?:number;linearFeet?:number;rooms?:number;condition?:string;materialsBy?:string;timeline?:string};
const round50=(n:number)=>Math.max(50,Math.round(n/50)*50);

export function localFallback(input: Input): Estimate {
  const sf=Math.max(1,input.squareFeet||0), lf=Math.max(1,input.linearFeet||0), rooms=Math.max(1,input.rooms||1);
  const service=input.service.toLowerCase(); let labor=0, materials=0, days=[2,5], scope:string[]=[];
  if(service.includes('paint')){labor=Math.max(450,sf?sf*2.4:rooms*850);materials=Math.max(180,sf?sf*.65:rooms*210);days=[1,Math.max(3,rooms*2)];scope=['Protect floors and contents','Patch and prepare surfaces','Apply finish coats','Complete trim and cleanup'];}
  else if(service.includes('drywall')){labor=Math.max(650,sf*3.25);materials=Math.max(250,sf*1.15);days=[2,7];scope=['Protect work area','Remove or prepare damaged material','Install and finish drywall','Sand and prepare for paint'];}
  else if(service.includes('floor')){labor=Math.max(750,sf*3.5);materials=input.materialsBy==='Platform supplies materials'?sf*3.25:Math.max(150,sf*.45);days=[2,8];scope=['Remove or prepare existing floor','Inspect and prepare subfloor','Install flooring system','Install transitions and clean area'];}
  else if(service.includes('bath')){labor=Math.max(5500,sf*95);materials=input.materialsBy==='Platform supplies materials'?Math.max(2500,sf*55):650;days=[7,18];scope=['Protect and demolish selected finishes','Complete approved rough work','Waterproof and install finishes','Install fixtures and complete final cleanup'];}
  else if(service.includes('waterproof')){labor=Math.max(2800,lf*58);materials=Math.max(900,lf*22);days=[2,8];scope=['Inspect water-entry conditions','Prepare drainage or wall system','Install approved waterproofing components','Test system and restore work area'];}
  else {labor=Math.max(750,sf*4.25);materials=Math.max(250,labor*.22);days=[2,8];scope=['Verify project conditions','Complete agreed preparation','Perform requested installation or repair','Final cleanup and walkthrough'];}
  const difficulty=input.condition==='Major repairs or difficult access'?1.25:input.condition==='Moderate repairs'?1.12:1;
  labor*=difficulty; materials*=difficulty;
  const payoutLow=round50(labor), payoutHigh=round50(labor*1.18);
  const subtotalLow=labor+materials, subtotalHigh=labor*1.18+materials*1.2;
  const customerLow=round50(subtotalLow/0.82), customerHigh=round50(subtotalHigh/0.78);
  return EstimateSchema.parse({
    projectSummary:`${input.service} project based on the submitted measurements and description.`, confidence: input.squareFeet||input.linearFeet?68:54,
    inspectionRequired:true, inspectionReason:'A site visit is recommended to confirm dimensions, access, preparation and hidden conditions.',
    scope:scope.map((title,i)=>({title,description:i===0?'Confirm conditions and protect the property before work begins.':'Complete this item according to the approved final scope.',quantity:i===0?1:(sf||lf||rooms),unit:i===0?'project':sf?'sq ft':lf?'linear ft':'rooms',laborLow:round50(labor/scope.length*.9),laborHigh:round50(labor/scope.length*1.1),materialsLow:round50(materials/scope.length*.85),materialsHigh:round50(materials/scope.length*1.15)})),
    assumptions:['Normal weekday access','Submitted measurements are reasonably accurate','No concealed hazardous materials or major structural damage'],
    exclusions:['Permit and inspection fees unless specifically added','Hazardous-material testing or remediation','Unseen structural, electrical, plumbing or moisture repairs'],
    riskFlags:['On-site verification required',...(service.includes('bath')||service.includes('waterproof')?['Hidden moisture or substrate damage may affect price']:[])],
    followUpQuestions:['Can you provide wide-angle photos of the full work area?','Are there access, parking or occupied-home limitations?'],
    customerPriceLow:customerLow,customerPriceHigh:customerHigh,contractorPayoutLow:payoutLow,contractorPayoutHigh:payoutHigh,
    durationDaysLow:days[0],durationDaysHigh:days[1],recommendedDepositPercent:50,
  });
}
