export const runtime = 'nodejs';

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getVoyageLoad, moveShipmentToVoyage } from '@/lib/assign'

export async function POST(req, ctx) {
  const { id: shipmentId } = await ctx.params
  const { voyageId } = await req.json()

  if (!voyageId) return NextResponse.json({ error: 'voyageId required' }, { status: 400 })

  const [shipment, voyage] = await Promise.all([
    prisma.shipment.findUnique({ where: { id: shipmentId } }),
    prisma.voyage.findUnique({ where: { id: voyageId } }),
  ])
  if (!shipment) return NextResponse.json({ error: 'Shipment not found' }, { status: 404 })
  if (!voyage)   return NextResponse.json({ error: 'Voyage not found' }, { status: 404 })

  const load = await getVoyageLoad(voyageId)
  if (!load) return NextResponse.json({ error: 'Voyage load unavailable' }, { status: 500 })

  const w = Number(shipment.weightTons || 0)
  const v = Number(shipment.volumeM3 || 0)
  if (load.remW < w || load.remV < v) {
    return NextResponse.json({ error: 'Insufficient capacity on target voyage' }, { status: 409 })
  }

  await moveShipmentToVoyage({ shipmentId, voyageId })
  return NextResponse.json({ ok: true, voyageId })
}
