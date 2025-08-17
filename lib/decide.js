// lib/decide.js
import { prisma } from "@/lib/db";

/** Sum current usage on a voyage (weight/volume) */
export async function voyageUsage(voyageId) {
  const assigns = await prisma.voyageAssignment.findMany({
    where: { voyageId },
    select: { shipment: { select: { weightTons: true, volumeM3: true } } },
  });
  let usedW = 0, usedV = 0;
  for (const a of assigns) {
    usedW += Number(a.shipment.weightTons || 0);
    usedV += Number(a.shipment.volumeM3 || 0);
  }
  return { usedW, usedV, count: assigns.length };
}

/** Get voyage by code with remaining capacities */
export async function getVoyageWithRemaining(voyageCode) {
  const v = await prisma.voyage.findFirst({ where: { voyageCode: { equals: voyageCode, mode: "insensitive" } } });
  if (!v) return null;
  const { usedW, usedV, count } = await voyageUsage(v.id);
  const capW = Number(v.weightCapT ?? 0) || null;
  const capV = Number(v.volumeCapM3 ?? 0) || null;

  const remW = capW != null ? Math.max(0, capW - usedW) : null;
  const remV = capV != null ? Math.max(0, capV - usedV) : null;

  const weightPct = capW ? Math.round((usedW / capW) * 100) : null;
  const volumePct = capV ? Math.round((usedV / capV) * 100) : null;

  return {
    voyage: v,
    usage: { usedW, usedV, count },
    remaining: { weightT: remW, volumeM3: remV },
    utilization: { weightPct, volumePct },
  };
}

/** Suggest voyages for a given shipment (by shipmentId or row id) */
export async function suggestVoyagesForShipment({ shipmentIdOrCode, k = 10 }) {
  // Load shipment
  const s = await prisma.shipment.findFirst({
    where: {
      OR: [
        { shipmentId: { equals: shipmentIdOrCode, mode: "insensitive" } },
        { id: shipmentIdOrCode },
      ],
    },
  });
  if (!s) return { shipment: null, suggestions: [] };

  // Find candidate voyages by lane & time
  const voyages = await prisma.voyage.findMany({
    where: {
      origin: { equals: s.origin, mode: "insensitive" },
      destination: { equals: s.destination, mode: "insensitive" },
      departAt: { gte: s.shipDate }, // departs after it ships
    },
    orderBy: { departAt: "asc" },
    take: 100,
  });

  // Compute remaining capacity and filter fit
  const suggestions = [];
  for (const v of voyages) {
    const detail = await getVoyageWithRemaining(v.voyageCode);
    if (!detail) continue;

    const needW = Number(s.weightTons || 0);
    const needV = Number(s.volumeM3 || 0);

    const enoughW = detail.remaining.weightT == null || detail.remaining.weightT >= needW;
    const enoughV = detail.remaining.volumeM3 == null || detail.remaining.volumeM3 >= needV;

    if (enoughW && enoughV) {
      const slackW = detail.remaining.weightT == null ? Infinity : (detail.remaining.weightT - needW);
      const slackV = detail.remaining.volumeM3 == null ? Infinity : (detail.remaining.volumeM3 - needV);
      suggestions.push({ voyageDetail: detail, slackW, slackV });
    }
  }

  // Sort by earliest depart, then smallest slack (tighter fit first)
  suggestions.sort((a, b) => {
    const da = new Date(a.voyageDetail.voyage.departAt).getTime();
    const db = new Date(b.voyageDetail.voyage.departAt).getTime();
    if (da !== db) return da - db;
    // Prefer tighter fit (less leftover) but still positive
    const sw = (a.slackW === Infinity ? 1e12 : a.slackW) - (b.slackW === Infinity ? 1e12 : b.slackW);
    if (sw !== 0) return sw;
    const sv = (a.slackV === Infinity ? 1e12 : a.slackV) - (b.slackV === Infinity ? 1e12 : b.slackV);
    return sv;
  });

  return { shipment: s, suggestions: suggestions.slice(0, k) };
}

/** Suggest shipments to fill a voyage (greedy fit) */
export async function suggestShipmentsForVoyage({ voyageCode, k = 20 }) {
  const detail = await getVoyageWithRemaining(voyageCode);
  if (!detail) return { voyage: null, picks: [] };

  const v = detail.voyage;
  let remW = detail.remaining.weightT ?? Infinity;
  let remV = detail.remaining.volumeM3 ?? Infinity;

  // candidates: matching lane, not delivered/returned, shipDate <= departAt, and not already assigned to this voyage
  const already = await prisma.voyageAssignment.findMany({
    where: { voyageId: v.id },
    select: { shipmentId: true },
  });
  const assignedIds = new Set(already.map(a => a.shipmentId));

  const candidates = await prisma.shipment.findMany({
    where: {
      origin: { equals: v.origin, mode: "insensitive" },
      destination: { equals: v.destination, mode: "insensitive" },
      status: { in: ["CREATED", "IN_TRANSIT"] },
      shipDate: { lte: v.departAt },
      id: { notIn: Array.from(assignedIds) },
    },
    orderBy: [{ isPriority: "desc" }, { shipDate: "asc" }],
    take: 200,
  });

  // Greedy: pick earliest/priorities first if they fit (both dims when provided)
  const picks = [];
  for (const s of candidates) {
    const w = Number(s.weightTons || 0);
    const vv = Number(s.volumeM3 || 0);

    const okW = (detail.remaining.weightT == null) || (remW >= w);
    const okV = (detail.remaining.volumeM3 == null) || (remV >= vv);
    if (okW && okV) {
      picks.push(s);
      remW = (detail.remaining.weightT == null) ? remW : (remW - w);
      remV = (detail.remaining.volumeM3 == null) ? remV : (remV - vv);
      if (picks.length >= k) break;
    }
  }

  return { voyage: v, remainingAfter: { weightT: remW, volumeM3: remV }, picks };
}
