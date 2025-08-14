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
- Notes/Context: ${notes || "n/a"}

Estimate if a delay is likely and suggest an adjusted ETA delta in days (positive=delay, negative=earlier).
Return STRICT JSON like: {"deltaDays": number, "reason": "short one-line reason"}.
If uncertain, return {"deltaDays": 0, "reason": "insufficient context"}.
`;
    const text = await askGemini(prompt, "You output only strict JSON.");
    return NextResponse.json({ raw: text });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "ai_error" }, { status: 500 });
  }
}
