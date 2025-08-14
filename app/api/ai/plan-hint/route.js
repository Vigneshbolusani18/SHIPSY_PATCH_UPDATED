// app/api/ai/plan-hint/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { askGeminiWithRetry, isQuotaError } from "@/lib/ai";

export async function POST(req) {
  try {
    const { shipments = [], vessel = {} } = await req.json();

    const prompt = `
You're a freight planner. Given shipments and optional vessel caps,
suggest a load order, call out skips if capacity is exceeded, and give 2–3 risk tips.

Vessel caps (optional):
- weightCap (tons): ${vessel.weightCap ?? "n/a"}
- volumeCap (m3): ${vessel.volumeCap ?? "n/a"}

Shipments (JSON):
\`\`\`json
${JSON.stringify(shipments, null, 2)}
\`\`\`

Return a short bullet list. Be concise.
`;

    const text = await askGeminiWithRetry(prompt);
    return NextResponse.json({ hint: text });
  } catch (e) {
    console.error("POST /api/ai/plan-hint error", e);
    const status = e?.status || 500;
    // Show friendly message for quota
    if (isQuotaError(e)) {
      return NextResponse.json(
        { error: "Gemini quota exceeded. Try again later or disable AI." },
        { status }
      );
    }
    return NextResponse.json({ error: e?.message || "AI error" }, { status });
  }
}
