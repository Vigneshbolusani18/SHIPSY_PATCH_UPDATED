// app/api/voyages/[id]/assign/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req, ctx) {
  const { id } = await ctx.params; // voyage id
  const { shipmentId } = await req.json();
  if (!shipmentId) return NextResponse.json({ error: 'shipmentId required' }, { status: 400 });

  const data = await prisma.voyageAssignment.create({
    data: { voyageId: id, shipmentId }
  });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req, ctx) {
  const { id } = await ctx.params; // voyage id
  const { searchParams } = new URL(req.url);
  const shipmentId = searchParams.get('shipmentId');
  if (!shipmentId) return NextResponse.json({ error: 'shipmentId required' }, { status: 400 });

  await prisma.voyageAssignment.deleteMany({ where: { voyageId: id, shipmentId } });
  return NextResponse.json({ ok: true });
}
