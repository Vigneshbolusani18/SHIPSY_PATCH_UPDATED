export const runtime = 'nodejs';

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const [inTransit, delivered, priority] = await Promise.all([
      prisma.shipment.count({ where: { status: 'IN_TRANSIT' } }),
      prisma.shipment.count({ where: { status: 'DELIVERED' } }),
      prisma.shipment.count({ where: { isPriority: true } }),
    ])

    return NextResponse.json(
      {
        inTransit,
        delivered,
        priority,
        lastUpdated: new Date().toISOString(),
      },
      {
        // don’t cache in the edge/CDN so the glass is fresh
        headers: { 'Cache-Control': 'no-store' },
      }
    )
  } catch (e) {
    console.error('GET /api/stats/overview error', e)
    return NextResponse.json({ inTransit: 0, delivered: 0, priority: 0 }, { status: 200 })
  }
}
