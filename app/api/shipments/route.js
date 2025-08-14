export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { estimatedDeliveryFrom, toBoolean } from '@/lib/shipment-utils';
import { pickBestVoyageForShipment, moveShipmentToVoyage } from '@/lib/assign';

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      shipmentId, status = 'CREATED', isPriority = false,
      origin, destination, shipDate, transitDays,
      weightTons, volumeM3
    } = body;

    if (!shipmentId || !origin || !destination || !shipDate || transitDays == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const created = await prisma.shipment.create({
      data: {
        shipmentId, status, isPriority: Boolean(isPriority),
        origin, destination,
        shipDate: new Date(shipDate),
        transitDays: Number(transitDays),
        weightTons: weightTons === '' || weightTons == null ? null : Number(weightTons),
        volumeM3:   volumeM3   === '' || volumeM3   == null ? null : Number(volumeM3),
      },
    });

    let assignedVoyageId = null;
    try {
      const best = await pickBestVoyageForShipment(created);
      if (best) {
        await moveShipmentToVoyage({ shipmentId: created.id, voyageId: best });
        assignedVoyageId = best;
      }
    } catch (e) { console.warn('Auto-assign failed:', e?.message || e); }

    return NextResponse.json(
      { ...created, assignedVoyageId, estimatedDelivery: estimatedDeliveryFrom(created.shipDate, created.transitDays) },
      { status: 201 }
    );
  } catch (e) {
    console.error('POST /api/shipments error', e);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get('page') || 1));
    const limit  = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 10)));
    const status = searchParams.get('status') || undefined;
    const q      = searchParams.get('q') || undefined;
    const isPr   = toBoolean(searchParams.get('isPriority'));
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const order  = (searchParams.get('order') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

    const where = {
      ...(status ? { status } : {}),
      ...(typeof isPr === 'boolean' ? { isPriority: isPr } : {}),
      ...(q ? { OR: [
        { shipmentId:  { contains: q, mode: 'insensitive' } },
        { origin:      { contains: q, mode: 'insensitive' } },
        { destination: { contains: q, mode: 'insensitive' } },
      ] } : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.shipment.count({ where }),
      prisma.shipment.findMany({
        where,
        orderBy: { [sortBy]: order },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          assignments: {
            include: { voyage: { select: { id: true, voyageCode: true } } },
            take: 1,
          }
        }
      }),
    ]);

    const items = rows.map(s => {
      const assigned = s.assignments?.[0]?.voyage || null;
      const { assignments, ...rest } = s;
      return {
        ...rest,
        estimatedDelivery: estimatedDeliveryFrom(s.shipDate, s.transitDays),
        assignedVoyage: assigned, // { id, voyageCode } | null
      };
    });

    return NextResponse.json({ page, limit, total, items });
  } catch (e) {
    console.error('GET /api/shipments error', e);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
