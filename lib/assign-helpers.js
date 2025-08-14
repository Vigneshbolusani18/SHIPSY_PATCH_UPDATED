// lib/assign-helpers.js
import { prisma } from '@/lib/db';

export async function getVoyageLoad(voyageId) {
  const v = await prisma.voyage.findUnique({
    where: { id: voyageId },
    select: {
      id: true, weightCapT: true, volumeCapM3: true,
      assignments: { include: { shipment: { select: { weightTons: true, volumeM3: true } } } }
    }
  });
  if (!v) return null;

  let usedW = 0, usedV = 0;
  for (const a of v.assignments) {
    usedW += Number(a.shipment?.weightTons ?? 0);
    usedV += Number(a.shipment?.volumeM3 ?? 0);
  }
  const capW = v.weightCapT ?? Infinity;
  const capV = v.volumeCapM3 ?? Infinity;

  return { usedW, usedV, capW, capV, remW: capW - usedW, remV: capV - usedV };
}

export function checkDateFit(voyage, shipment) {
  try {
    const shipDate = new Date(shipment.shipDate).getTime();
    const eta = new Date(new Date(shipment.shipDate).getTime() + shipment.transitDays * 86400000).getTime();
    const dep = new Date(voyage.departAt).getTime();
    const arr = new Date(voyage.arriveBy).getTime();
    // allow small slack (2 days) because real ops are noisy
    const SLACK = 2 * 86400000;
    return shipDate + SLACK >= dep && eta - SLACK <= arr;
  } catch {
    return true; // if dates messy, don't block (we still rely on AI intent)
  }
}

export function checkLaneFit(v, s) {
  const eq = (a,b) => String(a||'').toLowerCase() === String(b||'').toLowerCase();
  return eq(v.origin, s.origin) && eq(v.destination, s.destination);
}
