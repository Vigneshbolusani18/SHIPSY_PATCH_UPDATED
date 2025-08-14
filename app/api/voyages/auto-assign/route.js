export const runtime = 'nodejs';

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { pickBestVoyageForShipment, moveShipmentToVoyage } from '@/lib/assign'

export async function POST() {
  try {
    // find shipments with no assignments
    const unassigned = await prisma.shipment.findMany({
      where: { assignments: { none: {} } },
      orderBy: [{ isPriority: 'desc' }, { createdAt: 'asc' }]
    })

    const results = []
    let assignedCount = 0
    let failedCount = 0

    for (const s of unassigned) {
      const best = await pickBestVoyageForShipment(s)
      if (best) {
        await moveShipmentToVoyage({ shipmentId: s.id, voyageId: best })
        results.push({ shipmentId: s.shipmentId, assignedVoyageId: best })
        assignedCount++
      } else {
        results.push({ shipmentId: s.shipmentId, assignedVoyageId: null, reason: 'No voyage with capacity' })
        failedCount++
      }
    }

    return NextResponse.json({ ok: true, processed: unassigned.length, assignedCount, failedCount, results })
  } catch (e) {
    console.error('POST /api/voyages/auto-assign error', e)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}
