import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { EstimateSchema, localFallback } from '@/lib/estimate';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.service || !body.description || !body.address) return NextResponse.json({ error: 'Address, service and project description are required.' }, { status: 400 });
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json(localFallback(body));
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const prompt = `You create cautious preliminary home-improvement estimates for HomeQuote Local in the Serving all 50 states and Washington, D.C. market. Return ONLY valid JSON. Never call it final or binding. Use submitted measurements; never invent missing dimensions. Flag inspection, permits, lead paint, asbestos, mold, structural, gas, electrical, plumbing and moisture risks. Pricing must be realistic but conservative. Input: ${JSON.stringify(body)}. Required JSON keys: projectSummary, confidence, inspectionRequired, inspectionReason, scope[{title,description,quantity,unit,laborLow,laborHigh,materialsLow,materialsHigh}], assumptions[], exclusions[], riskFlags[], followUpQuestions[], customerPriceLow, customerPriceHigh, contractorPayoutLow, contractorPayoutHigh, durationDaysLow, durationDaysHigh, recommendedDepositPercent.`;
    const msg = await client.messages.create({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5', max_tokens: 2200, messages: [{ role: 'user', content: prompt }] });
    const block = msg.content.find(x => x.type === 'text');
    if (!block || block.type !== 'text') throw new Error('No text response');
    const parsed = EstimateSchema.parse(JSON.parse(block.text.replace(/```json|```/g, '').trim()));
    return NextResponse.json(parsed);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'We could not generate the estimate. Please review the information and try again.' }, { status: 500 });
  }
}
