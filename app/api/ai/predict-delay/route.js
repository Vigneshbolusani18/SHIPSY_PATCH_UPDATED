// app/api/ai/predict-delay/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { askGeminiWithRetry, isQuotaError } from "@/lib/ai";

export async function POST(req) {
  try {
    const { origin, destination, shipDate, transitDays } = await req.json();

    const prompt = `
You are an assistant estimating shipment delays.
Origin: ${origin}
Destination: ${destination}
Ship date: ${shipDate}
Planned transit (days): ${transitDays}

In 3 lines:
1) Likely delay (days or "none")
2) New ETA date (YYYY-MM-DD)
3) 1 actionable tip
`;

    const text = await askGeminiWithRetry(prompt);
    return NextResponse.json({ raw: text });
  } catch (e) {
    console.error("POST /api/ai/predict-delay error", e);
    const status = e?.status || 500;
    if (isQuotaError(e)) {
      return NextResponse.json(
        { error: "Gemini quota exceeded. Try again later." },
        { status }
      );
    }
    return NextResponse.json({ error: e?.message || "AI error" }, { status });
  }
}
