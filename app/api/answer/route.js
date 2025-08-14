export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { askGeminiWithRetry } from '@/lib/ai';
import { estimatedDeliveryFrom } from '@/lib/shipment-utils';

// ---------- helpers ----------
function norm(s) {
  return String(s || '').trim().toLowerCase();
}
function take(arr, n = 50) {
  return Array.isArray(arr) ? arr.slice(0, n) : [];
}

/**
 * Very small, safe "intent router":
 *  - No free-form SQL
 *  - Only whitelisted queries run
 *  - Always parameterized through Prisma
 */
async function routeIntent(questionRaw) {
  const question = norm(questionRaw);

  // 1) "how many shipments ... (by status/origin/destination/priority)"
  const mCountStatus = question.match(/how many shipments(?: are)?(?: in)? (\w[\w- ]+)/i);
  if (question.startsWith('how many shipments') || mCountStatus) {
    let where = {};
    // status filter
    const statusMap = {
      'created': 'CREATED',
      'in transit': 'IN_TRANSIT',
      'in-transit': 'IN_TRANSIT',
      'delivered': 'DELIVERED',
      'returned': 'RETURNED',
    };
    for (const [k, v] of Object.entries(statusMap)) {
      if (question.includes(k)) where.status = v;
    }
    // priority filter
    if (question.includes('priority')) where.isPriority = true;

    // origin/destination simple parse
    const o = question.match(/from (\w[\w\s-]+)/i);
    const d = question.match(/to (\w[\w\s-]+)/i);
    if (o) where.origin = { contains: o[1], mode: 'insensitive' };
    if (d) where.destination = { contains: d[1], mode: 'insensitive' };

    const count = await prisma.shipment.count({ where });
    return {
      intent: 'count_shipments',
      data: { where, count },
      textForModel: `Count of shipments matching filters: ${JSON.stringify(where)} = ${count}`
    };
  }

  // 2) "list shipments ...", "show shipments ..."
  if (question.startsWith('list shipments') || question.startsWith('show shipments') || question.includes('list of shipments')) {
    const where = {};
    const statusMap = {
      'created': 'CREATED',
      'in transit': 'IN_TRANSIT',
      'in-transit': 'IN_TRANSIT',
      'delivered': 'DELIVERED',
      'returned': 'RETURNED',
    };
    for (const [k, v] of Object.entries(statusMap)) {
      if (question.includes(k)) where.status = v;
    }
    if (question.includes('priority')) where.isPriority = true;

    const o = question.match(/from (\w[\w\s-]+)/i);
    const d = question.match(/to (\w[\w\s-]+)/i);
    if (o) where.origin = { contains: o[1], mode: 'insensitive' };
    if (d) where.destination = { contains: d[1], mode: 'insensitive' };

    const rows = await prisma.shipment.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 20
    });
    // add computed ETA
    const withEta = rows.map(s => ({
      ...s,
      estimatedDelivery: estimatedDeliveryFrom(s.shipDate, s.transitDays)
    }));
    return {
      intent: 'list_shipments',
      data: take(withEta, 20),
      textForModel: `Latest shipments (${withEta.length}): ${JSON.stringify(withEta, null, 2)}`
    };
  }

  // 3) "where is SHP-001" or "tracking for SHP-001"
  const mTrack = question.match(/(?:where is|tracking.*of|status of)\s+([a-z0-9_-]+)/i);
  if (mTrack) {
    const code = mTrack[1].toUpperCase();
    const s = await prisma.shipment.findFirst({
      where: { shipmentId: code }
    });
    if (!s) {
      return { intent: 'track_shipment', data: null, textForModel: `Shipment ${code} not found.` };
    }
    const events = await prisma.trackingEvent.findMany({
      where: { shipmentId: s.id },
      orderBy: { occurredAt: 'desc' },
      take: 20
    });
    const latest = events[0] || null;
    const eta = estimatedDeliveryFrom(s.shipDate, s.transitDays);
    return {
      intent: 'track_shipment',
      data: { shipment: s, latestEvent: latest, recentEvents: events, eta },
      textForModel: `Shipment ${s.shipmentId}: ${JSON.stringify({ shipment: s, latestEvent: latest, eta, recentEvents: events }, null, 2)}`
    };
  }

  // 4) "voyage utilization VOY-001"
  const mUtil = question.match(/voyage (?:util|utilization|capacity).*?([a-z0-9_-]+)/i);
  if (mUtil) {
    const code = mUtil[1].toUpperCase();
    const voyage = await prisma.voyage.findFirst({ where: { voyageCode: code } });
    if (!voyage) return { intent: 'voyage_util', data: null, textForModel: `Voyage ${code} not found.` };

    const assigns = await prisma.voyageAssignment.findMany({
      where: { voyageId: voyage.id },
      include: { shipment: true }
    });

    const totals = assigns.reduce((acc, a) => {
      const wt = Number(a.shipment.weightTons ?? 0);
      const vol = Number(a.shipment.volumeM3 ?? 0);
      acc.weight += wt; acc.volume += vol;
      return acc;
    }, { weight: 0, volume: 0 });

    const capW = Number(voyage.weightCapT ?? 0);
    const capV = Number(voyage.volumeCapM3 ?? 0);
    const utilization = {
      usedWeightT: totals.weight,
      usedVolumeM3: totals.volume,
      capWeightT: capW || null,
      capVolumeM3: capV || null,
      weight: capW ? Math.round((totals.weight / capW) * 100) : Math.round(totals.weight),
      volume: capV ? Math.round((totals.volume / capV) * 100) : Math.round(totals.volume),
    };

    return {
      intent: 'voyage_util',
      data: { voyage, totals, utilization, count: assigns.length },
      textForModel: `Voyage ${voyage.voyageCode} utilization: ${JSON.stringify({ totals, utilization, count: assigns.length }, null, 2)}`
    };
  }

  // 5) "which shipments are delayed" (ETA in the past and not delivered OR has DELAYED event)
  if (question.includes('which shipments are delayed') || question.includes('delayed shipments')) {
    const rows = await prisma.shipment.findMany({
      orderBy: { shipDate: 'desc' }, take: 200
    });

    const now = new Date();
    const delayedCand = rows.map(s => {
      const eta = estimatedDeliveryFrom(s.shipDate, s.transitDays);
      return {
        ...s,
        estimatedDelivery: eta,
        etaPast: eta && eta < now
      };
    });

    const ids = delayedCand.filter(s => s.etaPast && s.status !== 'DELIVERED').map(s => s.id);
    const delayEvents = await prisma.trackingEvent.findMany({
      where: { shipmentId: { in: ids }, eventType: 'DELAYED' },
      select: { shipmentId: true }
    });
    const delayedByEvent = new Set(delayEvents.map(e => e.shipmentId));
    const final = delayedCand.filter(s => s.etaPast || delayedByEvent.has(s.id));

    return {
      intent: 'delayed_shipments',
      data: take(final, 50),
      textForModel: `Delayed candidates: ${JSON.stringify(take(final, 50), null, 2)}`
    };
  }

  // 6) "which voyage is SHP-001 on"
  const mOnVoy = question.match(/which voyage .*?([a-z0-9_-]+)/i);
  if (mOnVoy) {
    const code = mOnVoy[1].toUpperCase();
    const s = await prisma.shipment.findFirst({ where: { shipmentId: code } });
    if (!s) return { intent: 'shipment_voyage', data: null, textForModel: `Shipment ${code} not found.` };

    // current = most recent assignment
    const a = await prisma.voyageAssignment.findFirst({
      where: { shipmentId: s.id },
      orderBy: { assignedAt: 'desc' },
      include: { voyage: true }
    });

    return {
      intent: 'shipment_voyage',
      data: { shipment: s, currentAssignment: a || null },
      textForModel: `Shipment ${s.shipmentId} current assignment: ${JSON.stringify(a, null, 2)}`
    };
  }

  // default: show a few KPIs so AI can still help
  const totals = await prisma.shipment.groupBy({
    by: ['status'],
    _count: { _all: true }
  });
  return {
    intent: 'fallback_summary',
    data: { kpis: totals },
    textForModel: `KPIs by status: ${JSON.stringify(totals, null, 2)}`
  };
}

// ---------- route ----------
export async function POST(req) {
  try {
    const { question = '' } = await req.json();
    if (!question) return NextResponse.json({ error: 'Missing question' }, { status: 400 });

    const routed = await routeIntent(question);

    const system = `
You are "Smart Freight AI". Answer strictly from the provided DATA.
- If data is missing for the question, say what is missing and suggest a precise follow-up.
- Be concise and use bullet points or a small table where helpful.
- Show exact shipmentId/voyageCode when referencing records.
`.trim();

    const prompt = `
${system}

USER QUESTION:
${question}

DATA (JSON):
${typeof routed.textForModel === 'string' ? routed.textForModel : JSON.stringify(routed.textForModel)}

Now write the best short answer grounded ONLY in the data above. If you infer something, label it "Assumption".
`.trim();

    const reply = await askGeminiWithRetry(prompt);
    return NextResponse.json({ intent: routed.intent, data: routed.data, answer: reply });
  } catch (e) {
    console.error('POST /api/ai/answer error', e);
    return NextResponse.json({ error: e?.message || 'AI answer error' }, { status: e?.status || 500 });
  }
}
