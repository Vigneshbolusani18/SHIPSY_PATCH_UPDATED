export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { askGeminiJSON, askGeminiWithRetry, isQuotaError } from '@/lib/ai'

function fitsWindow(shipDate, transitDays, departAt, arriveBy) {
  try {
    const sd = new Date(shipDate)
    const dep = new Date(departAt)
    const arr = new Date(arriveBy)
    const eta = new Date(sd); eta.setDate(eta.getDate() + Number(transitDays || 0))
    return dep >= sd && arr >= eta
  } catch { return false }
}

const toLower = s => String(s || '').toLowerCase().trim()
const daysBetween = (a, b) => Math.abs(new Date(a) - new Date(b)) / 86400000

export async function POST(_req, ctx) {
  try {
    const { id } = await ctx.params // shipment id
    const shipment = await prisma.shipment.findUnique({
      where: { id },
      include: { assignments: { include: { voyage: true }, take: 1 } }
    })
    if (!shipment) return NextResponse.json({ error: 'Shipment not found' }, { status: 404 })
    if (shipment.assignments?.length) return NextResponse.json({ ok: false, alreadyAssigned: true })

    // voyages + utilization
    const voyagesRaw = await prisma.voyage.findMany({
      include: { assignments: { include: { shipment: true } } },
      orderBy: { departAt: 'asc' },
      take: 300
    })

    const voyages = voyagesRaw.map(v => {
      const usedW = v.assignments.reduce((sum, a) => sum + Number(a.shipment?.weightTons || 0), 0)
      const usedV = v.assignments.reduce((sum, a) => sum + Number(a.shipment?.volumeM3 || 0), 0)
      const capW = Number(v.weightCapT || 0)
      const capV = Number(v.volumeCapM3 || 0)
      return {
        id: v.id,
        voyageCode: v.voyageCode,
        origin: v.origin,
        destination: v.destination,
        departAt: v.departAt,
        arriveBy: v.arriveBy,
        capW, capV,
        usedW, usedV,
        remW: Math.max(0, capW - usedW),
        remV: Math.max(0, capV - usedV)
      }
    })

    // === First try: single-leg assignment (AI + strict verification) ===
    let pick = null, why = ''
    const aiPrompt = `
Return STRICT JSON ONLY with this shape:
{"pick":{"voyageCode": "..."},"why":"...reason..."}
Rules:
- Choose a voyage only if ALL constraints pass:
  lane: normalize(origin)==normalize(shipment.origin) AND normalize(destination)==normalize(shipment.destination)
  time: departAt >= shipDate AND arriveBy >= (shipDate + transitDays days)
  capacity: remW >= weightTons AND remV >= volumeM3
- Prefer earlier departAt, higher remW/remV, and lower assignedCount (spread load).
- If NO feasible voyage, set pick to null.

Data:
${JSON.stringify({
  shipment: {
    id: shipment.id,
    shipmentId: shipment.shipmentId,
    isPriority: !!shipment.isPriority,
    origin: shipment.origin,
    destination: shipment.destination,
    shipDate: shipment.shipDate,
    transitDays: shipment.transitDays,
    weightTons: Number(shipment.weightTons || 0),
    volumeM3: Number(shipment.volumeM3 || 0),
  },
  voyages: voyages.map(v => ({
    voyageCode: v.voyageCode,
    origin: v.origin, destination: v.destination,
    departAt: v.departAt, arriveBy: v.arriveBy,
    remW: v.remW, remV: v.remV,
    assignedCount: voyagesRaw.find(x => x.id === v.id)?.assignments.length || 0
  }))
})}
`.trim()

    try {
      const out = await askGeminiJSON(aiPrompt, { model: 'gemini-1.5-flash', maxRetries: 1 })
      pick = out?.pick ?? null
      why = out?.why ?? ''
    } catch (e) {
      if (!isQuotaError(e)) console.warn('AI JSON failed (single-leg pick)', e?.message || e)
    }

    // deterministic fallback if AI failed or null
    const w = Number(shipment.weightTons || 0)
    const vol = Number(shipment.volumeM3 || 0)
    const origin = toLower(shipment.origin)
    const dest   = toLower(shipment.destination)

    if (!pick || !pick.voyageCode) {
      const cand = voyages
        .filter(x =>
          toLower(x.origin) === origin &&
          toLower(x.destination) === dest &&
          fitsWindow(shipment.shipDate, shipment.transitDays, x.departAt, x.arriveBy) &&
          x.remW >= w && x.remV >= vol
        )
        .sort((a,b) => new Date(a.departAt) - new Date(b.departAt))[0]

      if (cand) pick = { voyageCode: cand.voyageCode }
    }

    // If we have a pick, verify and commit
    if (pick && pick.voyageCode) {
      const chosen = voyages.find(v => v.voyageCode === pick.voyageCode)
      if (!chosen) return NextResponse.json({ ok: false, reason: 'AI chose unknown voyageCode', why })

      const laneOK =
        toLower(chosen.origin) === origin &&
        toLower(chosen.destination) === dest
      const timeOK = fitsWindow(shipment.shipDate, shipment.transitDays, chosen.departAt, chosen.arriveBy)
      const capOK  = chosen.remW >= w && chosen.remV >= vol

      if (!laneOK || !timeOK || !capOK) {
        // fall through to planHint section
      } else {
        await prisma.voyageAssignment.create({ data: { voyageId: chosen.id, shipmentId: shipment.id } })
        return NextResponse.json({ ok: true, voyageId: chosen.id, voyageCode: chosen.voyageCode, why })
      }
    }

    // === No direct feasible lane: ask AI for a tiny multi-leg PLAN HINT (no commit) ===
    // Keep the context small & relevant to avoid heavy load.
    const CAND_LIMIT = 60
    const near = voyages
      .filter(v =>
        toLower(v.origin) === origin ||
        toLower(v.destination) === dest ||
        daysBetween(v.departAt, shipment.shipDate) <= 10
      )
      .sort((a,b) => new Date(a.departAt) - new Date(b.departAt))
      .slice(0, CAND_LIMIT)

    const list = near.map(v =>
      `- ${v.voyageCode}: ${v.origin}→${v.destination} | dep ${new Date(v.departAt).toISOString()} | arr ${new Date(v.arriveBy).toISOString()} | remW ${v.remW} | remV ${v.remV}`
    ).join('\n')

    let planHint = ''
    const planPrompt = `
You are a logistics planner. There is no feasible DIRECT voyage for this shipment right now.
Propose up to 3 SHORT multi-leg route ideas **using ONLY the voyages listed** below.

Constraints for each proposed chain:
- chronological: next.departAt >= previous.arriveBy + 6h buffer
- first leg departAt >= shipDate
- final arrival >= shipDate + transitDays days (ETA window)
- each leg capacity: remW >= shipment.weightTons AND remV >= shipment.volumeM3

Output style: 3–6 lines of plain text. Each line:
"SHP-${shipment.shipmentId}: ORIGIN→MID (VOY-X, mm/dd→mm/dd) → DEST (VOY-Y, mm/dd→mm/dd). Reason: ..."
Keep it concise; no extra prose.

Shipment:
- origin=${shipment.origin}, destination=${shipment.destination}
- shipDate=${new Date(shipment.shipDate).toISOString()}, transitDays=${shipment.transitDays}
- weightTons=${w}, volumeM3=${vol}

Voyages (subset):
${list || '(none)'}
`.trim()

    try {
      planHint = await askGeminiWithRetry(planPrompt, { model: 'gemini-1.5-flash', maxRetries: 1 })
    } catch (e) {
      if (!isQuotaError(e)) console.warn('AI planHint failed', e?.message || e)
      planHint = 'No direct lane. Consider connecting via nearby ports that respect depart/arrive times and remaining capacity.'
    }

    return NextResponse.json({
      ok: false,
      reason: 'No feasible direct lane (lane/time/capacity).',
      planHint
    })
  } catch (e) {
    console.error('POST /api/shipments/[id]/ai-assign error', e)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}
