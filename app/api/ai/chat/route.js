// app/api/ai/chat/route.js
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { askGeminiWithRetry } from '@/lib/ai';

export async function POST(req) {
  try {
    const { messages = [], context = {} } = await req.json();

    // Build a simple conversation prompt for Gemini
    const system = `
You are Smart Freight AI. Be brief, clear, and helpful.
Project context:
- Domain: Logistics (Shipments, Voyages, Capacity planning, Tracking)
- Capabilities: pagination/filter/search CRUD, FFD planning, AI ETA+, AI plan hints
- Output: short paragraphs or bullet points; use simple formatting.

If user asks for actions (plan/assign), provide step-by-step guidance or pseudo-SQL/JS
— do not invent data. If you estimate ETAs, say it's an estimate.
    `.trim();

    const history = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    const ctxText = Object.entries(context || {})
      .map(([k, v]) => `- ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join('\n');

    const prompt = `
${system}

Optional context:
${ctxText || '- none -'}

Conversation so far:
${history}

ASSISTANT:
`.trim();

    const reply = await askGeminiWithRetry(prompt);
    return NextResponse.json({ reply });
  } catch (e) {
    console.error('POST /api/ai/chat error', e);
    return NextResponse.json({ error: 'AI error' }, { status: 500 });
  }
}
