export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// simple token-based lane similarity
function laneScore(aFrom, aTo, bFrom, bTo) {
  const norm = s => String(s||'').toLowerCase().trim()
  const A = [norm(aFrom), norm(aTo)]
  const B = [norm(bFrom), norm(bTo)]
  let score = 0
  if (A[0] && B[0] && (A[0] === B[0])) score += 0.5
  else if (A[0] && B[0] && (A[0].startsWith(B[0]) || B[0].startsWith(A[0]))) score += 0.25
  if (A[1] && B[1] && (A[1] === B[1])) score += 0.5
  else if (A[1] && B[1] && (A[1].startsWith(B[1]) || B[1].startsWith(A[1]))) score += 0.25
  return score // 0..1
}

function fitsWindow(shipDate, transitDays, departAt, arriveBy) {
  try {
    const sd = new Date(shipDate)
    const dep = new Date(departAt)
    const arr = new Date(arriveBy)
    const eta = new Date(sd); eta.setDate(eta.getDate() + Number(transitDays || 0))
    // depart on/after shipDate is okay, and arrive after ETA
    return (dep >= sd || Math.abs(dep - sd) < 36e5) && arr >= eta
  } catch { return false }
}

export async function POST() {
  try {
    // Pull ships & voyages with current utilization
    const [shipments, voyagesRaw] = await Promise.all([
      prisma.shipment.findMany({
        where: {
          // unassigned only
          assignments: { none: {} },
          status: { in: ['CREATED','IN_TRANSIT'] }
        },
        orderBy: [{ isPriority: 'desc' }, { shipDate: 'asc' }],
        take: 500
      }),
      prisma.voyage.findMany({
        include: {
          _count: { select: { assignments: true } },
          assignments: {
            include: { shipment: true }
          }
        },
        orderBy: { departAt: 'asc' },
        take: 200
      })
    ])

    // Precompute remaining capacity per voyage
    const voyages = voyagesRaw.map(v => {
      const usedW = v.assignments.reduce((sum,a)=> sum + Number(a.shipment?.weightTons || 0), 0)
      const usedV = v.assignments.reduce((sum,a)=> sum + Number(a.shipment?.volumeM3 || 0), 0)
      const capW = Number(v.weightCapT || 0)
      const capV = Number(v.volumeCapM3 || 0)
      return {
        ...v,
        usedW, usedV,
        remW: Math.max(0, capW - usedW),
        remV: Math.max(0, capV - usedV),
      }
    })

    let assignedCount = 0
    const processed = shipments.length
    const messages = []

    // Greedy: best score per shipment
    for (const s of shipments) {
      const w = Number(s.weightTons || 0)
      const vol = Number(s.volumeM3 || 0)

      const candidates = voyages
        .filter(v => fitsWindow(s.shipDate, s.transitDays, v.departAt, v.arriveBy))
        .map(v => {
          const ls = laneScore(s.origin, s.destination, v.origin, v.destination)
          const capOK = (v.remW >= w) && (v.remV >= vol)
          // prioritize priority shipments, then lane score, then earliest departure, then capacity slack
          const slackW = v.remW - w
          const slackV = v.remV - vol
          const score =
            (s.isPriority ? 1 : 0) * 2 +
            ls * 3 +
            (capOK ? 1 : -5) +
            Math.max(0, 0.5 * Math.min(slackW / (v.weightCapT || 1), slackV / (v.volumeCapM3 || 1)))
          return { v, score, capOK, lane: ls }
        })
        .sort((a,b)=> b.score - a.score)

      const best = candidates[0]
      if (!best || !best.capOK || best.score < 0) {
        messages.push(`⚠️ ${s.shipmentId}: no suitable voyage (lane/window/capacity).`)
        continue
      }

      // Assign
      await prisma.voyageAssignment.create({
        data: { voyageId: best.v.id, shipmentId: s.id }
      })
      // update remaining in our local struct
      best.v.remW -= w; best.v.remV -= vol
      assignedCount++
      messages.push(`✅ ${s.shipmentId} → ${best.v.voyageCode} (${best.v.origin}→${best.v.destination}, laneScore=${best.lane.toFixed(2)})`)
    }

    return NextResponse.json({ assignedCount, processed, messages })
  } catch (e) {
    console.error('POST /api/voyages/auto-assign error', e)
    return NextResponse.json({ error: e?.message || 'Auto-assign error' }, { status: 500 })
  }
}
