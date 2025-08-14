export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { estimatedDeliveryFrom } from '@/lib/shipment-utils';

// GET /api/shipments/:id
export async function GET(req, context) {
  try {
    const { id } = await context.params;   // await params in Next 15
    const s = await prisma.shipment.findUnique({ where: { id } });
    if (!s) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ ...s, estimatedDelivery: estimatedDeliveryFrom(s.shipDate, s.transitDays) });
  } catch (e) {
    console.error('GET /shipments/:id error', e);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}

// PUT /api/shipments/:id
export async function PUT(req, context) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const data = {};
    for (const k of ['shipmentId', 'status', 'origin', 'destination']) {
      if (body[k] != null) data[k] = body[k];
    }
    if (body.isPriority != null) data.isPriority = Boolean(body.isPriority);
    if (body.shipDate != null)   data.shipDate   = new Date(body.shipDate);
    if (body.transitDays != null) data.transitDays = Number(body.transitDays);

    const updated = await prisma.shipment.update({ where: { id }, data });
    return NextResponse.json({ ...updated, estimatedDelivery: estimatedDeliveryFrom(updated.shipDate, updated.transitDays) });
  } catch (e) {
    console.error('PUT /shipments/:id error', e);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}

// DELETE /api/shipments/:id
export async function DELETE(req, context) {
  try {
    const { id } = await context.params;
    await prisma.shipment.delete({ where: { id } });
    return NextResponse.json({ message: 'deleted' });
  } catch (e) {
    console.error('DELETE /shipments/:id error', e);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
