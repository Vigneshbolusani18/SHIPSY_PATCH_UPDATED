export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { askGeminiWithRetry, isQuotaError } from '@/lib/ai'

// minimal prompt that encourages best lane/time/capacity use
function buildPrompt(payload) {
  return `
You are assigning shipments to voyages.

Rules (hard):
- Assign only if: lane matches (city names aligned), shipDate <= voyage.departAt (or same day), and voyage.arriveBy >= (shipDate + transitDays).
- Do NOT exceed voyage remaining capacity for weightTons and volumeM3.
- Prefer: priority shipments, better lane match, earlier departures.

Return ONLY a JSON object with this shape:
{
  "assign": [
    { "shipmentId": "<exact-shipmentId>", "voyageCode": "<exact-voyageCode>" },
    ...
  ]
}

No explanations, no markdown — just valid JSON.

DATA:
${JSON.stringify(payload, null, 2)}
`.trim()
}

export async function POST() {
  try {
    // Pull unassigned shipments & voyages with capacities
    const [shipments, voyagesRaw] = await Promise.all([
      prisma.shipment.findMany({
        where: { assignments: { none: {} }, status: { in: ['CREATED','IN_TRANSIT'] } },
        orderBy: [{ isPriority: 'desc' }, { shipDate: 'asc' }],
        take: 400
      }),
      prisma.voyage.findMany({
        include: { assignments: { include: { shipment: true } } },
        orderBy: { departAt: 'asc' },
        take: 150
      })
    ])

    const voyages = voyagesRaw.map(v => {
      const usedW = v.assignments.reduce((sum,a)=> sum + Number(a.shipment?.weightTons || 0), 0)
      const usedV = v.assignments.reduce((sum,a)=> sum + Number(a.shipment?.volumeM3 || 0), 0)
      return {
        voyageCode: v.voyageCode,
        id: v.id,
        origin: v.origin,
        destination: v.destination,
      departAt: v.departAt,
        arriveBy: v.arriveBy,
        weightCapT: Number(v.weightCapT || 0),
        volumeCapM3: Number(v.volumeCapM3 || 0),
        remW: Math.max(0, Number(v.weightCapT || 0) - usedW),
        remV: Math.max(0, Number(v.volumeCapM3 || 0) - usedV),
      }
    })

    const payload = {
      shipments: shipments.map(s => ({
        id: s.id, shipmentId: s.shipmentId, isPriority: !!s.isPriority,
        origin: s.origin, destination: s.destination,
        shipDate: s.shipDate, transitDays: s.transitDays,
        weightTons: Number(s.weightTons || 0), volumeM3: Number(s.volumeM3 || 0),
      })),
      voyages
    }

    let suggestions = []
    try {
      const text = await askGeminiWithRetry(buildPrompt(payload))
      suggestions = JSON.parse(text)?.assign || []
    } catch (e) {
      if (!isQuotaError(e)) throw e
      // quota fallback: simple local proposal — pair by exact lane & earliest departure with capacity
      suggestions = []
      for (const s of payload.shipments) {
        const cand = voyages
          .filter(v => (v.origin?.toLowerCase() === s.origin?.toLowerCase())
                    && (v.destination?.toLowerCase() === s.destination?.toLowerCase())
                    && (new Date(v.departAt) >= new Date(s.shipDate)))
          .sort((a,b)=> new Date(a.departAt) - new Date(b.departAt))[0]
        if (cand) suggestions.push({ shipmentId: s.shipmentId, voyageCode: cand.voyageCode })
      }
    }

    // Validate and write
    const byShipmentId = new Map(shipments.map(s => [s.shipmentId, s]))
    const byVoyCode = new Map(voyages.map(v => [v.voyageCode, v]))

    let assigned = 0
    const processed = payload.shipments.length
    const messages = []

    function fitsWindow(shipDate, transitDays, departAt, arriveBy) {
      try {
        const sd = new Date(shipDate)
        const dep = new Date(departAt)
        const arr = new Date(arriveBy)
        const eta = new Date(sd); eta.setDate(eta.getDate() + Number(transitDays || 0))
        return (dep >= sd || Math.abs(dep - sd) < 36e5) && arr >= eta
      } catch { return false }
    }

    for (const rec of suggestions) {
      const s = byShipmentId.get(rec.shipmentId)
      const v = byVoyCode.get(rec.voyageCode)
      if (!s || !v) {
        messages.push(`⚠️ Skipped unknown pair: ${rec.shipmentId} → ${rec.voyageCode}`)
        continue
      }

      // lane check (loose)
      const laneOK =
        s.origin?.toLowerCase().trim().startsWith(String(v.origin||'').toLowerCase().trim()) &&
        s.destination?.toLowerCase().trim().startsWith(String(v.destination||'').toLowerCase().trim())

      // window + capacity
      const w = Number(s.weightTons || 0), vol = Number(s.volumeM3 || 0)
      const timeOK = fitsWindow(s.shipDate, s.transitDays, v.departAt, v.arriveBy)
      const capOK = (v.remW >= w) && (v.remV >= vol)

      if (!laneOK || !timeOK || !capOK) {
        messages.push(
          `⚠️ ${s.shipmentId} → ${v.voyageCode} rejected `
          + `(${laneOK ? '' : 'lane '}${timeOK ? '' : 'time '}${capOK ? '' : 'capacity '}).`
        )
        continue
      }

      await prisma.voyageAssignment.create({ data: { voyageId: v.id, shipmentId: s.id } })
      v.remW -= w; v.remV -= vol
      assigned++
      messages.push(`✅ ${s.shipmentId} assigned to ${v.voyageCode} · ${v.origin}→${v.destination} · dep ${new Date(v.departAt).toLocaleDateString()}`)
    }

    return NextResponse.json({ assigned, processed, messages })
  } catch (e) {
    console.error('POST /api/voyages/ai-assign error', e)
    return NextResponse.json({ error: e?.message || 'AI assign error' }, { status: 500 })
  }
}
