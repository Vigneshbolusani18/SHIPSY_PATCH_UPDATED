// app/api/voyages/ai-assign/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { askGeminiWithRetry, isQuotaError } from '@/lib/ai';

const toLower = (s) => String(s || '').toLowerCase().trim();
const toNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

function fitsWindow(shipDate, transitDays, departAt, arriveBy) {
  try {
    const sd = new Date(shipDate);
    const dep = new Date(departAt);
    const arr = new Date(arriveBy);
    const eta = new Date(sd);
    eta.setDate(eta.getDate() + Number(transitDays || 0));
    return dep >= sd && arr >= eta;
  } catch {
    return false;
  }
}

function daysBetween(a, b) {
  return Math.abs(new Date(a) - new Date(b)) / 86400000;
}

export async function POST() {
  try {
    // 1) Pull unassigned shipments + voyages (with utilization)
    const [shipments, voyagesRaw] = await Promise.all([
      prisma.shipment.findMany({
        where: { assignments: { none: {} }, status: { in: ['CREATED', 'IN_TRANSIT'] } },
        orderBy: [{ isPriority: 'desc' }, { shipDate: 'asc' }],
        take: 400
      }),
      prisma.voyage.findMany({
        include: { assignments: { include: { shipment: true } } },
        orderBy: { departAt: 'asc' },
        take: 300
      })
    ]);

    // Precompute remaining capacity snapshot
    const voyages = voyagesRaw.map((v) => {
      const usedW = v.assignments.reduce((s, a) => s + toNum(a.shipment?.weightTons, 0), 0);
      const usedV = v.assignments.reduce((s, a) => s + toNum(a.shipment?.volumeM3, 0), 0);
      const capW = toNum(v.weightCapT, 0);
      const capV = toNum(v.volumeCapM3, 0);
      return {
        id: v.id,
        voyageCode: v.voyageCode,
        origin: v.origin,
        destination: v.destination,
        departAt: v.departAt,
        arriveBy: v.arriveBy,
        remW: Math.max(0, capW - usedW),
        remV: Math.max(0, capV - usedV),
        assignedCount: v.assignments.length,
      };
    });

    let assigned = 0;
    const processed = shipments.length;
    const messages = [];
    const pairs = [];

    // Quick index
    const byVoyCode = new Map(voyages.map((v) => [v.voyageCode, v]));
    const leftovers = [];

    // 2) Strict direct assignment pass (deterministic & cheap)
    for (const s of shipments) {
      const w = toNum(s.weightTons, 0);
      const v = toNum(s.volumeM3, 0);
      const origin = toLower(s.origin);
      const dest = toLower(s.destination);

      const cand = voyages
        .filter(
          (vg) =>
            toLower(vg.origin) === origin &&
            toLower(vg.destination) === dest &&
            fitsWindow(s.shipDate, s.transitDays, vg.departAt, vg.arriveBy) &&
            vg.remW >= w &&
            vg.remV >= v
        )
        // Prefer earlier depart; tie-breaker lower assignedCount, then more remaining capacity
        .sort((a, b) =>
          new Date(a.departAt) - new Date(b.departAt) ||
          a.assignedCount - b.assignedCount ||
          (b.remW + b.remV) - (a.remW + a.remV)
        )[0];

      if (!cand) {
        leftovers.push(s);
        continue;
      }

      // Commit assignment
      await prisma.voyageAssignment.create({ data: { voyageId: cand.id, shipmentId: s.id } });
      cand.remW -= w;
      cand.remV -= v;
      cand.assignedCount += 1;

      assigned++;
      pairs.push({ shipmentId: s.shipmentId, voyageCode: cand.voyageCode });
      messages.push(`✅ ${s.shipmentId} → ${cand.voyageCode}`);
    }

    // 3) For leftovers: ask AI for small multi-leg plan hints (no commit)
    if (leftovers.length) {
      const MAX_SHIP = 25;           // cap for cost
      const MAX_VOY_PER_SHIP = 20;   // compact per shipment
      const subset = leftovers.slice(0, MAX_SHIP);

      const blocks = [];
      for (const s of subset) {
        const origin = toLower(s.origin);
        const dest = toLower(s.destination);
        const w = toNum(s.weightTons, 0);
        const v = toNum(s.volumeM3, 0);

        const cand = voyages
          .filter(
            (vg) =>
              toLower(vg.origin) === origin ||
              toLower(vg.destination) === dest ||
              daysBetween(vg.departAt, s.shipDate) <= 10
          )
          .sort((a, b) => new Date(a.departAt) - new Date(b.departAt))
          .slice(0, MAX_VOY_PER_SHIP)
          .map(
            (vg) =>
              `- ${vg.voyageCode}: ${vg.origin}→${vg.destination} | dep ${new Date(
                vg.departAt
              ).toISOString()} | arr ${new Date(vg.arriveBy).toISOString()} | remW ${vg.remW} | remV ${vg.remV}`
          )
          .join('\n');

        blocks.push(
          `SHP ${s.shipmentId} | from=${s.origin} to=${s.destination} | shipDate=${new Date(
            s.shipDate
          ).toISOString()} | transitDays=${s.transitDays} | weightTons=${w} | volumeM3=${v}\n${cand || '(no close voyages)'}`
        );
      }

      if (blocks.length) {
        const prompt = `
You are a logistics planner. For each shipment below, there is NO feasible DIRECT lane right now.
Propose up to 2 SHORT multi-leg ideas **using ONLY the voyages listed under that shipment**.

Constraints for each chain:
- chronological: next.departAt >= previous.arriveBy + 6h buffer
- first leg departAt >= shipDate
- final arrival >= (shipDate + transitDays days)
- each leg capacity: remW >= shipment.weightTons AND remV >= shipment.volumeM3

OUTPUT: plain text lines, one or two per shipment, starting with the shipmentId.
Format each line like:
"💡 SHP-123: A→B (VOY-X, mm/dd→mm/dd) → D (VOY-Y, mm/dd→mm/dd). Reason: …"

Shipments & candidate voyages:
${blocks.join('\n\n')}
`.trim();

        try {
          const txt = await askGeminiWithRetry(prompt, { model: 'gemini-1.5-flash', maxRetries: 1 });
          for (const line of String(txt || '').split('\n')) {
            const l = line.trim();
            if (l) messages.push(l);
          }
        } catch (e) {
          if (!isQuotaError(e)) console.warn('AI plan hints failed:', e?.message || e);
          for (const s of subset) {
            messages.push(`💡 ${s.shipmentId}: No direct lanes. Consider multi-leg via nearby ports while respecting time windows & capacity.`);
          }
        }
      }
    }

    return NextResponse.json({ assigned, processed, pairs, messages });
  } catch (e) {
    console.error('POST /api/voyages/ai-assign error', e);
    return NextResponse.json(
      { assigned: 0, processed: 0, pairs: [], messages: [], error: e?.message || 'AI auto-assign error' },
      { status: 500 }
    );
  }
}
