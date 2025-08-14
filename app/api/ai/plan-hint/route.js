// app/api/ai/plan-hint/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { askGeminiWithRetry } from "@/lib/ai";

export async function POST(req) {
  try {
    const { vessel, shipments } = await req.json();

    const capLines = [
      vessel?.weightCap ? `- Vessel weight cap: ${vessel.weightCap} tons` : null,
      vessel?.volumeCap ? `- Vessel volume cap: ${vessel.volumeCap} m³`   : null,
    ].filter(Boolean).join("\n");

    const rows = (shipments || []).map(s => {
      return `- ${s.shipmentId} | status=${s.status} | prio=${s.isPriority ? 'Y' : 'N'} | ${s.origin}→${s.destination} | shipDate=${s.shipDate} | transitDays=${s.transitDays}${s.weightTons ? ` | wt=${s.weightTons}t` : ''}${s.volumeM3 ? ` | vol=${s.volumeM3}m³` : ''}`;
    }).join("\n");

    const prompt = `
You are a freight planner.
Given a list of shipments and (optional) vessel caps, propose a short loading/assignment hint:

Return concise markdown with:
- A suggested loading order (by shipmentId)
- Any likely skips if capacity constrained (and why)
- 2-3 practical delay-minimization tips

INPUT
${capLines || "- No explicit caps provided"}
Shipments:
${rows || "- (none provided)"}
`.trim();

    const hint = await askGeminiWithRetry({
      prompt,
      primary: "gemini-1.5-flash",
      fallback: "gemini-1.5-flash-8b",
      maxRetries: 4,
      baseDelay: 700,
    });

    return NextResponse.json({ hint });
  } catch (e) {
    const msg = String(e?.message || "");
    const overloaded =
      e?.status === 503 ||
      /503|overloaded|busy|Service Unavailable/i.test(msg);

    return NextResponse.json(
      { error: overloaded ? "AI is temporarily busy. Please try again." : "AI error." },
      { status: overloaded ? 503 : 500 }
    );
  }
}
