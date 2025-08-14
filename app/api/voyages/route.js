// app/api/voyages/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const page  = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const q     = searchParams.get('q') || '';

  const where = q
    ? {
        OR: [
          { voyageCode: { contains: q, mode: 'insensitive' } },
          { vesselName: { contains: q, mode: 'insensitive' } },
          { origin: { contains: q, mode: 'insensitive' } },
          { destination: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.voyage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.voyage.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, limit });
}

export async function POST(req) {
  const body = await req.json();
  const {
    voyageCode, vesselName, origin, destination,
    departAt, arriveBy, weightCapT, volumeCapM3
  } = body;

  if (!voyageCode || !vesselName || !origin || !destination || !departAt || !arriveBy) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const v = await prisma.voyage.create({
    data: {
      voyageCode, vesselName, origin, destination,
      departAt: new Date(departAt),
      arriveBy: new Date(arriveBy),
      weightCapT: weightCapT ? Number(weightCapT) : null,
      volumeCapM3: volumeCapM3 ? Number(volumeCapM3) : null,
    }
  });

  return NextResponse.json(v, { status: 201 });
}
