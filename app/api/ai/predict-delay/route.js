export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { askGemini } from "@/lib/ai";

export async function POST(req) {
  try {
    const { origin, destination, shipDate, transitDays, notes } = await req.json();
    const prompt = `
Given a shipment:
- Origin: ${origin}
- Destination: ${destination}
- Ship Date: ${shipDate}
- Planned Transit Days: ${transitDays}
- Notes: ${notes || "n/a"}
Estimate delay likelihood and suggest ETA delta days (positive=delay, negative=earlier).
Return STRICT JSON: {"deltaDays": number, "reason": "one-line"}.
If uncertain, return {"deltaDays": 0, "reason": "insufficient context"}.
`;
    const text = await askGemini(prompt, "You output only strict JSON.");
    return NextResponse.json({ raw: text });
  } catch (e) {
    console.error(e); return NextResponse.json({ error: "ai_error" }, { status: 500 });
  }
}
