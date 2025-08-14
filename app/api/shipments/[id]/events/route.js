export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/shipments/:id/events
export async function GET(req, context) {
  try {
    const { id } = await context.params;
    const events = await prisma.trackingEvent.findMany({
      where: { shipmentId: id },
      orderBy: { occurredAt: 'desc' },
    });
    return NextResponse.json({ items: events });
  } catch (e) {
    console.error('GET /events error', e);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}

// POST /api/shipments/:id/events
export async function POST(req, context) {
  try {
    const { id } = await context.params;
    const { eventType, location, notes, occurredAt } = await req.json();

    if (!eventType || !location) {
      return NextResponse.json({ error: 'eventType and location are required' }, { status: 400 });
    }

    const exists = await prisma.shipment.findUnique({ where: { id } });
    if (!exists) return NextResponse.json({ error: 'shipment not found' }, { status: 404 });

    const created = await prisma.trackingEvent.create({
      data: {
        shipmentId: id,
        eventType,
        location,
        notes: notes || null,
        occurredAt: occurredAt ? new Date(occurredAt) : undefined,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error('POST /events error', e);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
