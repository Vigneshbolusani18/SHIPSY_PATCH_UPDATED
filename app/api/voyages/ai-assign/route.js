export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { aiScoreAssignments } from '@/lib/ai-assign';
import { getVoyageLoad, checkDateFit, checkLaneFit } from '@/lib/assign-helpers';
import { pickBestVoyageForShipment, moveShipmentToVoyage } from '@/lib/assign'; // fallback

export async function POST() {
  try {
    // 1) pull voyages + unassigned shipments + recent events
    const [voyages, unassigned] = await Promise.all([
      prisma.voyage.findMany(),
      prisma.shipment.findMany({
        where: { assignments: { none: {} } },
        orderBy: [{ isPriority: 'desc' }, { createdAt: 'asc' }],
      }),
    ]);

    if (!unassigned.length) {
      return NextResponse.json({ ok: true, processed: 0, assigned: 0, results: [] });
    }

    const events = await prisma.trackingEvent.findMany({
      where: { shipmentId: { in: unassigned.map((s) => s.id) } },
      orderBy: { occurredAt: 'desc' },
    });
    const eventsByShipment = {};
    for (const ev of events) {
      (eventsByShipment[ev.shipmentId] ||= []).push(ev);
    }

    // 2) ask AI for suggestions (robust parse happens inside)
    let suggestions = { assignments: [] };
    try {
      suggestions = await aiScoreAssignments({ voyages, shipments: unassigned, eventsByShipment });
    } catch {
      suggestions = { assignments: [] }; // model down? we'll fallback below
    }

    const aiMap = new Map();
    for (const a of suggestions.assignments || []) {
      if (a && a.shipmentId && typeof a.voyageId !== 'undefined') aiMap.set(a.shipmentId, a.voyageId);
    }

    // 3) apply with capacity/date checks; fallback if needed
    const loads = new Map();
    async function cachedLoad(voyageId) {
      if (!loads.has(voyageId)) loads.set(voyageId, await getVoyageLoad(voyageId));
      return loads.get(voyageId);
    }

    const results = [];
    let assigned = 0;

    for (const s of unassigned) {
      // ignore finalized shipments
      if (s.status === 'DELIVERED' || s.status === 'RETURNED') {
        results.push({ shipmentId: s.shipmentId, assignedVoyageId: null, reason: 'finalized status' });
        continue;
      }

      // helper: does shipment fit voyage by cap + soft lane/date checks
      async function fits(voyageId) {
        const v = voyages.find((x) => x.id === voyageId);
        if (!v) return { ok: false, reason: 'voyage not found' };

        // Soft preferences (not blockers): lane and date
        const laneOk = checkLaneFit(v, s);
        const dateOk = checkDateFit(v, s);

        // Hard checks: weight/volume capacity (Infinity == unlimited)
        const load = await cachedLoad(voyageId);
        if (!load) return { ok: false, reason: 'load missing' };

        const w = Number(s.weightTons || 0);
        const vol = Number(s.volumeM3 || 0);
        const capOk =
          (load.capW === Infinity || load.remW >= w) &&
          (load.capV === Infinity || load.remV >= vol);

        if (!capOk) return { ok: false, reason: 'capacity exceeded' };

        // Return a score preferring lane & date fits (used if we need to compare)
        let score = 0;
        if (laneOk) score += 1;
        if (dateOk) score += 1;
        // prefer voyages that keep more remaining capacity afterwards
        const remScore =
          (load.capW === Infinity ? 1 : (load.remW - w) / Math.max(1, load.capW)) +
          (load.capV === Infinity ? 1 : (load.remV - vol) / Math.max(1, load.capV));
        score += remScore / 2;
        return { ok: true, score, laneOk, dateOk };
      }

      // try AI suggestion first
      let chosen = aiMap.get(s.id) || null;
      let chosenReason = 'ai_suggested';

      if (chosen) {
        const check = await fits(chosen);
        if (!check.ok) {
          // AI picked a voyage that doesn't fit; try find a better one among all
          const candidates = [];
          for (const v of voyages) {
            const f = await fits(v.id);
            if (f.ok) candidates.push({ voyageId: v.id, score: f.score });
          }
          if (candidates.length) {
            candidates.sort((a, b) => b.score - a.score);
            chosen = candidates[0].voyageId;
            chosenReason = 'ai_replaced_by_best_fit';
          } else {
            // fallback deterministic picker
            const fb = await pickBestVoyageForShipment(s);
            if (fb) {
              chosen = fb;
              chosenReason = 'fallback_picker';
            } else {
              results.push({
                shipmentId: s.shipmentId,
                assignedVoyageId: null,
                reason: 'no capacity on any voyage',
              });
              continue;
            }
          }
        }
      } else {
        // no AI suggestion; try best fit or fallback
        const candidates = [];
        for (const v of voyages) {
          const f = await fits(v.id);
          if (f.ok) candidates.push({ voyageId: v.id, score: f.score });
        }
        if (candidates.length) {
          candidates.sort((a, b) => b.score - a.score);
          chosen = candidates[0].voyageId;
          chosenReason = 'best_fit';
        } else {
          const fb = await pickBestVoyageForShipment(s);
          if (fb) {
            chosen = fb;
            chosenReason = 'fallback_picker';
          } else {
            results.push({
              shipmentId: s.shipmentId,
              assignedVoyageId: null,
              reason: 'no capacity on any voyage',
            });
            continue;
          }
        }
      }

      // persist move (ensures only one active assignment)
      await moveShipmentToVoyage({ shipmentId: s.id, voyageId: chosen });

      // update cached load (since we just assigned)
      const load = await cachedLoad(chosen);
      const w = Number(s.weightTons || 0);
      const vol = Number(s.volumeM3 || 0);
      // mutate cache so subsequent fits() see updated remaining
      if (load) {
        load.usedW += w;
        load.usedV += vol;
        load.remW = (load.capW === Infinity) ? Infinity : Math.max(0, load.capW - load.usedW);
        load.remV = (load.capV === Infinity) ? Infinity : Math.max(0, load.capV - load.usedV);
        loads.set(chosen, load);
      }

      assigned++;
      results.push({ shipmentId: s.shipmentId, assignedVoyageId: chosen, reason: chosenReason });
    }

    return NextResponse.json({
      ok: true,
      processed: unassigned.length,
      assigned,
      results,
    });
  } catch (e) {
    console.error('POST /api/voyages/ai-assign error', e);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
