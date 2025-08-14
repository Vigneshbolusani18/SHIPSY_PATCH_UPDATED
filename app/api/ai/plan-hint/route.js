export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { askGemini } from "@/lib/ai";

export async function POST(req) {
  try {
    const { vessel = {}, shipments = [] } = await req.json();
   const prompt = `
You are assisting with shipment loading prioritization **with capacity constraints**.
Use weightTons and volumeM3 when present. Prefer: isPriority, IN_TRANSIT, earlier shipDate, shorter transitDays, and cluster similar lanes.
Vessel capacity: ${JSON.stringify(vessel)}
Shipments: ${JSON.stringify(shipments.map(s => ({
  shipmentId: s.shipmentId, status: s.status, isPriority: s.isPriority,
  origin: s.origin, destination: s.destination, shipDate: s.shipDate, transitDays: s.transitDays,
  weightTons: s.weightTons, volumeM3: s.volumeM3
}))).slice(0,7000)}
Return concise bullets:
- Feasible loading order (shipmentId)
- If capacity insufficient, which to skip and why (weight/volume)
- 1–2 operational tips
`;

    const hint = await askGemini(prompt, "Logistics planner writing crisp bullet points.");
    return NextResponse.json({ hint });
  } catch (e) {
    console.error(e); return NextResponse.json({ error: "ai_error" }, { status: 500 });
  }
}
