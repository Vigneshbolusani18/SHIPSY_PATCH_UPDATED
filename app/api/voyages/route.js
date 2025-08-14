export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

function toNum(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

// GET /api/voyages?page&limit&q
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, toNum(searchParams.get('page'), 1));
    const limit = Math.min(100, Math.max(1, toNum(searchParams.get('limit'), 20)));
    const q = searchParams.get('q') || undefined;

    const where = q ? {
      OR: [
        { voyageCode:  { contains: q, mode: 'insensitive' } },
        { vesselName:  { contains: q, mode: 'insensitive' } },
        { origin:      { contains: q, mode: 'insensitive' } },
        { destination: { contains: q, mode: 'insensitive' } },
      ]
    } : {};

    const [total, rows] = await Promise.all([
      prisma.voyage.count({ where }),
      prisma.voyage.findMany({
        where,
        orderBy: { departAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          assignments: true, // so UI can show counts if needed
        }
      })
    ]);

    // shape to lean payload
    const items = rows.map(v => ({
      id: v.id,
      voyageCode: v.voyageCode,
      vesselName: v.vesselName,
      origin: v.origin,
      destination: v.destination,
      departAt: v.departAt,
      arriveBy: v.arriveBy,
      weightCapT: v.weightCapT,
      volumeCapM3: v.volumeCapM3,
      assignedCount: v.assignments.length
    }));

    return NextResponse.json({ page, limit, total, items });
  } catch (e) {
    console.error('GET /api/voyages error', e);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}

// POST /api/voyages  (create a voyage quickly from UI or seed)
export async function POST(req) {
  try {
    const body = await req.json();
    const {
      voyageCode, vesselName, origin, destination,
      departAt, arriveBy, weightCapT, volumeCapM3
    } = body;

    if (!voyageCode || !vesselName || !origin || !destination || !departAt || !arriveBy) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const created = await prisma.voyage.create({
      data: {
        voyageCode, vesselName, origin, destination,
        departAt: new Date(departAt),
        arriveBy: new Date(arriveBy),
        weightCapT: weightCapT == null || weightCapT === '' ? null : Number(weightCapT),
        volumeCapM3: volumeCapM3 == null || volumeCapM3 === '' ? null : Number(volumeCapM3),
      }
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error('POST /api/voyages error', e);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
