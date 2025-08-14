export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/shipments/:id/events  → list newest first
export async function GET(_req, { params }) {
  try {
    const { id } = params;
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

// POST /api/shipments/:id/events  → create
// body: { eventType, location, notes?, occurredAt? }
export async function POST(req, { params }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { eventType, location, notes, occurredAt } = body;

    if (!eventType || !location) {
      return NextResponse.json({ error: 'eventType and location are required' }, { status: 400 });
    }

    // ensure shipment exists (optional but nice)
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
