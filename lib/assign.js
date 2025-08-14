// lib/assign.js
import { prisma } from '@/lib/db'

/** Sum the current load on a voyage (weight/volume). Treat null caps as Infinity (unlimited). */
export async function getVoyageLoad(voyageId) {
  const v = await prisma.voyage.findUnique({
    where: { id: voyageId },
    select: {
      id: true, weightCapT: true, volumeCapM3: true,
      assignments: {
        include: { shipment: { select: { weightTons: true, volumeM3: true } } }
      }
    }
  })
  if (!v) return null

  const capW = v.weightCapT ?? Infinity
  const capV = v.volumeCapM3 ?? Infinity

  let usedW = 0, usedV = 0
  for (const a of v.assignments) {
    usedW += Number(a.shipment?.weightTons ?? 0)
    usedV += Number(a.shipment?.volumeM3 ?? 0)
  }

  return {
    usedW, usedV, capW, capV,
    remW: Number.isFinite(capW) ? Math.max(0, capW - usedW) : Infinity,
    remV: Number.isFinite(capV) ? Math.max(0, capV - usedV) : Infinity,
  }
}

/**
 * Choose the "best" voyage for a shipment:
 * - If caps are null → treated as unlimited, so always fits.
 * - Score prefers voyages that stay within caps and keep balance.
 * - Optionally filter by lanes/dates (left disabled for now).
 */
export async function pickBestVoyageForShipment(shipment) {
  const w = Number(shipment.weightTons || 0)
  const v = Number(shipment.volumeM3 || 0)

  const voyages = await prisma.voyage.findMany({
    select: { id: true, voyageCode: true, weightCapT: true, volumeCapM3: true }
  })
  if (!voyages.length) return null

  let best = null
  let bestScore = -Infinity

  for (const vg of voyages) {
    const load = await getVoyageLoad(vg.id)
    if (!load) continue

    // Must fit (or unlimited)
    const fitsWeight = load.remW === Infinity || load.remW >= w
    const fitsVolume = load.remV === Infinity || load.remV >= v
    if (!fitsWeight || !fitsVolume) continue

    // Scoring: higher remaining capacity balance is better
    const capW = load.capW === Infinity ? 1 : load.capW
    const capV = load.capV === Infinity ? 1 : load.capV
    const afterW = load.remW === Infinity ? 1 : (load.remW - w) / capW
    const afterV = load.remV === Infinity ? 1 : (load.remV - v) / capV
    const score = (afterW + afterV) / 2

    if (score > bestScore) {
      bestScore = score
      best = vg.id
    }
  }

  return best // may be null
}

/** Remove any existing assignment and assign shipment to voyage in one tx. */
export async function moveShipmentToVoyage({ shipmentId, voyageId }) {
  await prisma.$transaction(async (tx) => {
    await tx.voyageAssignment.deleteMany({ where: { shipmentId } })
    await tx.voyageAssignment.create({ data: { shipmentId, voyageId } })
  })
}
