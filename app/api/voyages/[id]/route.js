export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getVoyageLoad } from '@/lib/assign';

export async function GET(_req, ctx) {
  try {
    const { id } = await ctx.params;

    const voyage = await prisma.voyage.findUnique({
      where: { id },
      include: {
        assignments: {
          include: {
            shipment: {
              select: {
                id: true, shipmentId: true, status: true,
                origin: true, destination: true,
                shipDate: true, transitDays: true,
                weightTons: true, volumeM3: true,
                isPriority: true,
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!voyage) {
      return NextResponse.json({ error: 'Voyage not found' }, { status: 404 });
    }

    const load = await getVoyageLoad(voyage.id); // { usedW, usedV, capW, capV, remW, remV }

    // compute utilization %
    const utilW = Number.isFinite(load.capW) && load.capW > 0
      ? Math.round((load.usedW / load.capW) * 100)
      : (load.usedW > 0 ? 100 : 0);
    const utilV = Number.isFinite(load.capV) && load.capV > 0
      ? Math.round((load.usedV / load.capV) * 100)
      : (load.usedV > 0 ? 100 : 0);

    const shipments = voyage.assignments.map(a => a.shipment);

    return NextResponse.json({
      voyage: {
        id: voyage.id,
        voyageCode: voyage.voyageCode,
        vesselName: voyage.vesselName,
        origin: voyage.origin,
        destination: voyage.destination,
        departAt: voyage.departAt,
        arriveBy: voyage.arriveBy,
        weightCapT: voyage.weightCapT,
        volumeCapM3: voyage.volumeCapM3,
      },
      utilization: {
        weight: utilW,    // %
        volume: utilV,    // %
        usedWeightT: Number(load.usedW.toFixed(2)),
        usedVolumeM3: Number(load.usedV.toFixed(2)),
        capWeightT: load.capW === Infinity ? null : load.capW,
        capVolumeM3: load.capV === Infinity ? null : load.capV,
      },
      shipments,
    });
  } catch (e) {
    console.error('GET /api/voyages/[id] error', e);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
