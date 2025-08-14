export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { askGemini } from "@/lib/ai";

export async function POST(req) {
  try {
    const { vessel = {}, shipments = [] } = await req.json();

    const prompt = `
You are assisting with shipment loading prioritization.
If weight/volume are missing, prioritize by: isPriority, status (IN_TRANSIT > CREATED), earlier shipDate, shorter transitDays, and cluster similar routes (origin/destination).
Vessel capacity (may be empty): ${JSON.stringify(vessel)}
Shipments (sampled): ${JSON.stringify(shipments).slice(0, 7000)}

Return concise bullet points with:
- A suggested loading order (by shipmentId)
- Any items to consider skipping if capacity is constrained (if capacity provided)
- 1-2 general tips to reduce delays

Keep it crisp and scannable.
`;
    const hint = await askGemini(prompt, "Logistics planner writing crisp bullet points.");
    return NextResponse.json({ hint });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "ai_error" }, { status: 500 });
  }
}
