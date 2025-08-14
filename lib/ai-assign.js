// lib/ai-assign.js
import { askGeminiWithRetry } from '@/lib/ai';

/**
 * Ask Gemini to score voyages per shipment.
 * Input is compact; output is a JSON map of {shipmentId: voyageId|null}.
 * We still *validate* capacity & dates server-side after we get the AI suggestion.
 */
export async function aiScoreAssignments({ voyages, shipments, eventsByShipment }) {
  // Build compact prompt
  const prompt = `
You are a logistics planner. Choose the best voyage for each shipment.
Goals, in order:
1) Shipment status: CREATED/IN_TRANSIT only; DELIVERED/RETURNED should remain unassigned (null).
2) Priority: isPriority=true should be preferred.
3) Lane/date fit: prefer voyages matching origin/destination and where shipDate >= voyage.departAt and estimatedDelivery <= voyage.arriveBy when possible.
4) Tracking events: a shipment with DELAYED or many late scans should avoid tight voyages.
5) Capacity: prefer assignments that are likely to fit weight/volume (we will hard-check after your suggestion).
6) Balance load across voyages.

Return STRICT JSON:
{
  "assignments": [
    { "shipmentId": "<shipment.id>", "voyageId": "<voyage.id or null>", "reason": "short note" }
  ]
}

Data:
Voyages: ${JSON.stringify(voyages.map(v => ({
    id: v.id,
    voyageCode: v.voyageCode,
    origin: v.origin,
    destination: v.destination,
    departAt: v.departAt,
    arriveBy: v.arriveBy,
    weightCapT: v.weightCapT ?? null,
    volumeCapM3: v.volumeCapM3 ?? null
  })))}

Shipments: ${JSON.stringify(shipments.map(s => ({
    id: s.id,
    shipmentId: s.shipmentId,
    status: s.status,
    isPriority: s.isPriority,
    origin: s.origin,
    destination: s.destination,
    shipDate: s.shipDate,
    transitDays: s.transitDays,
    weightTons: s.weightTons ?? 0,
    volumeM3: s.volumeM3 ?? 0
  })))}

RecentEvents: ${JSON.stringify(Object.fromEntries(
    shipments.map(s => [s.id, (eventsByShipment[s.id] || []).slice(0, 5).map(ev => ({
      type: ev.eventType, when: ev.occurredAt, where: ev.location
    }))])
  ))}
`.trim();

  const raw = await askGeminiWithRetry(prompt, 3);
  // Defensive parse
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    // Some models wrap JSON in code fences or add text; try to extract JSON
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    data = jsonMatch ? JSON.parse(jsonMatch[0]) : { assignments: [] };
  }
  if (!data || !Array.isArray(data.assignments)) return { assignments: [] };
  return data;
}
