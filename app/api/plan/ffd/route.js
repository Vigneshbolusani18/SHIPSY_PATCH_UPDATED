// app/api/plan/ffd/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";

function withinFilters(s, filters) {
  if (!filters) return true;
  const { origin, destination, startAfter } = filters;
  if (origin && !s.origin?.toLowerCase().includes(origin.toLowerCase())) return false;
  if (destination && !s.destination?.toLowerCase().includes(destination.toLowerCase())) return false;
  if (startAfter) {
    const d = new Date(s.shipDate);
    const cut = new Date(startAfter);
    if (!(d >= cut)) return false;
  }
  return true;
}

// Classic First-Fit Decreasing on the dominant resource
export async function POST(req) {
  try {
    const { vessel = {}, shipments = [], filters } = await req.json();

    const capW = Number.isFinite(Number(vessel.weightCap)) ? Number(vessel.weightCap) : Infinity;
    const capV = Number.isFinite(Number(vessel.volumeCap)) ? Number(vessel.volumeCap) : Infinity;

    const pool = shipments.filter(s => withinFilters(s, filters));

    if (!pool.length) {
      return NextResponse.json({
        assigned: [],
        skipped: [],
        utilization: { weight: 0, volume: 0 },
        note: "No shipments match your lane/date filters."
      });
    }

    // choose dominant dimension (the one with a finite cap and tighter)
    const dom = capW === Infinity && capV === Infinity
      ? "weight"
      : (capW !== Infinity && capV !== Infinity
          ? (capW <= capV ? "weight" : "volume")
          : (capW !== Infinity ? "weight" : "volume"));

    const sorted = [...pool].sort((a, b) => {
      const aw = Number(a.weightTons ?? 0), bw = Number(b.weightTons ?? 0);
      const av = Number(a.volumeM3 ?? 0),  bv = Number(b.volumeM3 ?? 0);
      const aDom = dom === "weight" ? aw : av;
      const bDom = dom === "weight" ? bw : bv;
      if (bDom - aDom !== 0) return bDom - aDom; // decreasing
      // tie-break: priority desc, earlier date
      const pa = a.isPriority ? 1 : 0, pb = b.isPriority ? 1 : 0;
      if (pb - pa !== 0) return pb - pa;
      return new Date(a.shipDate) - new Date(b.shipDate);
    });

    let usedW = 0, usedV = 0;
    const assigned = [];
    const skipped = [];

    for (const s of sorted) {
      const w = Number(s.weightTons ?? 0);
      const v = Number(s.volumeM3 ?? 0);
      const okW = usedW + w <= capW;
      const okV = usedV + v <= capV;
      if (okW && okV) {
        assigned.push(s.shipmentId);
        usedW += w;
        usedV += v;
      } else {
        const reason = (!okW && !okV) ? "weight+volume" : (!okW ? "weight" : "volume");
        skipped.push({ shipmentId: s.shipmentId, reason });
      }
    }

    const util = {
      weight: capW === Infinity ? 0 : Math.round((usedW / capW) * 100),
      volume: capV === Infinity ? 0 : Math.round((usedV / capV) * 100),
    };

    return NextResponse.json({ assigned, skipped, utilization: util });
  } catch (e) {
    console.error("POST /api/plan/ffd error", e);
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}
