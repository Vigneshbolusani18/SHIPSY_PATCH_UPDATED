export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { estimatedDeliveryFrom, toBoolean } from '@/lib/shipment-utils';

// POST /api/shipments  → create
export async function POST(req) {
  try {
    const body = await req.json();
    const { shipmentId, status = 'CREATED', isPriority = false, origin, destination, shipDate, transitDays } = body;

    if (!shipmentId || !origin || !destination || !shipDate || transitDays == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const created = await prisma.shipment.create({
      data: {
        shipmentId,
        status,
        isPriority: Boolean(isPriority),
        origin,
        destination,
        shipDate: new Date(shipDate),
        transitDays: Number(transitDays),
      },
    });

    return NextResponse.json(
      { ...created, estimatedDelivery: estimatedDeliveryFrom(created.shipDate, created.transitDays) },
      { status: 201 }
    );
  } catch (e) {
    console.error('POST /api/shipments error', e);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}

// GET /api/shipments?page&limit&status&isPriority&q&sortBy&order
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
      }),
    ]);

    const items = rows.map(s => ({
      ...s,
      estimatedDelivery: estimatedDeliveryFrom(s.shipDate, s.transitDays),
    }));

    return NextResponse.json({ page, limit, total, items });
  } catch (e) {
    console.error('GET /api/shipments error', e);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
