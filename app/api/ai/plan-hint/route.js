// app/api/ai/plan-hint/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { askGeminiWithRetry, isQuotaError } from "@/lib/ai";

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

function packHeuristic(shipments, caps) {
  // sort by: priority desc, earlier shipDate, then larger weight+volume (or smaller—experiment)
  const sorted = [...shipments].sort((a, b) => {
    const pa = a.isPriority ? 1 : 0;
    const pb = b.isPriority ? 1 : 0;
    if (pb - pa !== 0) return pb - pa;
    const da = new Date(a.shipDate).getTime();
    const db = new Date(b.shipDate).getTime();
    if (da - db !== 0) return da - db;
    const sa = (a.weightTons ?? 0) + (a.volumeM3 ?? 0) / 10;
    const sb = (b.weightTons ?? 0) + (b.volumeM3 ?? 0) / 10;
    return sb - sa; // larger first to avoid fragmentation
  });

  const capW = Number.isFinite(caps?.weightCap) ? caps.weightCap : Infinity;
  const capV = Number.isFinite(caps?.volumeCap) ? caps.volumeCap : Infinity;
  let usedW = 0, usedV = 0;

  const assigned = [];
  const skipped = [];

  for (const s of sorted) {
    const w = Number(s.weightTons ?? 0);
    const v = Number(s.volumeM3 ?? 0);
    const okW = usedW + w <= capW;
    const okV = usedV + v <= capV;
    if (okW && okV) {
      assigned.push(s);
      usedW += w;
      usedV += v;
    } else {
      const reason = (!okW && !okV) ? "weight+volume" : (!okW ? "weight" : "volume");
      skipped.push({ shipmentId: s.shipmentId, reason });
    }
  }
  const utilW = capW === Infinity ? 0 : Math.round((usedW / capW) * 100);
  const utilV = capV === Infinity ? 0 : Math.round((usedV / capV) * 100);

  return { assigned, skipped, utilization: { weight: utilW, volume: utilV } };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { vessel = {}, shipments = [], filters } = body || {};

    const pool = shipments.filter(s => withinFilters(s, filters));

    // If no shipments after filtering, bail early
    if (!pool.length) {
      return NextResponse.json({ hint: "No shipments match your lane/date filters." }, { status: 200 });
    }

    // local heuristic pack to give a concrete baseline
    const base = packHeuristic(pool, {
      weightCap: Number.isFinite(vessel.weightCap) ? vessel.weightCap : undefined,
      volumeCap: Number.isFinite(vessel.volumeCap) ? vessel.volumeCap : undefined,
    });

    // Try Gemini for a human-friendly narrative; fall back to local summary
    const prompt = `
You are a logistics planner. Write a short plan hint (≤120 words) for the following candidate shipments and vessel caps.
Focus on: load order (priority first, earlier dates), which ones won't fit, and 1–2 risk tips.
Return plain text (no JSON).

FILTERS: ${JSON.stringify(filters || {}, null, 0)}
CAPS: ${JSON.stringify(vessel || {}, null, 0)}

CANDIDATES:
${pool.map(s => `- ${s.shipmentId} ${s.origin}→${s.destination} · ${s.status} · ship ${s.shipDate} · ${s.transitDays}d · prio:${s.isPriority?'Y':'N'} · wt:${s.weightTons??'-'} · vol:${s.volumeM3??'-'}`).join('\n')}
`.trim();

    let hintText;
    try {
      hintText = await askGeminiWithRetry(prompt);
    } catch (e) {
      if (!isQuotaError(e)) throw e;
      // graceful local hint
      const order = base.assigned.map(s => s.shipmentId);
      hintText =
        `Load Order: ${order.join(', ') || '(none)'}.\n` +
        (base.skipped.length
          ? `Skipped: ${base.skipped.map(x => `${x.shipmentId}(${x.reason})`).join(', ')}.\n`
          : '') +
        `Utilization: ${base.utilization.weight}% weight, ${base.utilization.volume}% volume.`;
    }

    return NextResponse.json({
      hint: hintText,
      baseline: {
        assigned: base.assigned.map(s => s.shipmentId),
        skipped: base.skipped,
        utilization: base.utilization
      }
    });
  } catch (e) {
    console.error("POST /api/ai/plan-hint error", e);
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}
