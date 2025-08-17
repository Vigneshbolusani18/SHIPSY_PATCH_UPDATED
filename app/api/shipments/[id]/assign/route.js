// app/api/shipments/[id]/assign/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const BIG = 1e12;
const norm = s => String(s ?? '').trim().toLowerCase();

function fitsWindow(shipDate, transitDays, departAt, arriveBy) {
  try {
    const sd  = new Date(shipDate);
    const dep = new Date(departAt);
    const arr = new Date(arriveBy);
    const eta = new Date(sd);
    eta.setDate(eta.getDate() + Number(transitDays || 0));
    return dep >= sd && arr >= eta;
  } catch { return false; }
}

export async function POST(req, ctx) {
  try {
    const { id } = await ctx.params; // shipment id
    const s = await prisma.shipment.findUnique({
      where: { id },
      include: { assignments: true }
    });
    if (!s) return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });
    if (s.assignments.length) return NextResponse.json({ ok: true, alreadyAssigned: true });

    const voyagesRaw = await prisma.voyage.findMany({
      include: { assignments: { include: { shipment: true } } },
      orderBy: { departAt: 'asc' },
      take: 200
    });

    const voyages = voyagesRaw.map(v => {
      const usedW = v.assignments.reduce((sum, a) => sum + Number(a.shipment?.weightTons || 0), 0);
      const usedV = v.assignments.reduce((sum, a) => sum + Number(a.shipment?.volumeM3 || 0), 0);
      const capW  = v.weightCapT  == null || v.weightCapT  === '' ? BIG : Number(v.weightCapT);
      const capV  = v.volumeCapM3 == null || v.volumeCapM3 === '' ? BIG : Number(v.volumeCapM3);
      return {
        ...v,
        nOrigin: norm(v.origin),
        nDest:   norm(v.destination),
        remW: Math.max(0, capW - usedW),
        remV: Math.max(0, capV - usedV),
      };
    });

    const w = Number(s.weightTons || 0);
    const v = Number(s.volumeM3   || 0);
    const sO = norm(s.origin), sD = norm(s.destination);

    const cand = voyages
      .filter(x =>
        x.nOrigin === sO &&
        x.nDest   === sD &&
        fitsWindow(s.shipDate, s.transitDays, x.departAt, x.arriveBy) &&
        x.remW >= w && x.remV >= v
      )
      .sort((a, b) => {
        const t = new Date(a.departAt) - new Date(b.departAt);
        if (t !== 0) return t;
        // prefer tighter leftover to pack better
        const la = (a.remW - w) + (a.remV - v);
        const lb = (b.remW - w) + (b.remV - v);
        return la - lb;
      })[0];

    if (!cand) return NextResponse.json({ ok: false, reason: 'No feasible voyage' });

    await prisma.voyageAssignment.create({ data: { voyageId: cand.id, shipmentId: s.id } });
    return NextResponse.json({ ok: true, voyageCode: cand.voyageCode });
  } catch (e) {
    console.error('POST /shipments/[id]/assign error', e);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
