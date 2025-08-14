// app/api/ai/predict-delay/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { askGeminiWithRetry } from '@/lib/ai';

export async function POST(req) {
  try {
    const { origin, destination, shipDate, transitDays } = await req.json();

    const prompt = `
You are a logistics assistant. Estimate the delay risk and propose a refined ETA window.
Return 3 concise bullets only.

Input:
- origin: ${origin}
- destination: ${destination}
- shipDate (ISO): ${shipDate}
- planned transit days: ${transitDays}

Consider typical lane delays, terminal handoffs, weekends, and buffer.
Output format exactly:
- Risk: <low|medium|high> - <primary driver>
- ETA window: <YYYY-MM-DD> to <YYYY-MM-DD>
- Note: <one practical suggestion>
`.trim();

    const text = await askGeminiWithRetry({
      prompt,
      primary: "gemini-1.5-flash",
      fallback: "gemini-1.5-flash-8b",
      maxRetries: 4,
      baseDelay: 700,
    });

    return NextResponse.json({ raw: text });
  } catch (e) {
    const msg = String(e?.message || "");
    const overloaded =
      e?.status === 503 ||
      /503|overloaded|busy|Service Unavailable/i.test(msg);

    return NextResponse.json(
      { error: overloaded ? "AI is temporarily busy. Please try again in a few seconds." : "AI error." },
      { status: overloaded ? 503 : 500 }
    );
  }
}
