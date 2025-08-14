// app/api/voyages/[id]/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_req, ctx) {
  const { id } = await ctx.params;
  const v = await prisma.voyage.findUnique({
    where: { id },
    include: {
      assignments: { include: { shipment: true } }
    }
  });
  if (!v) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(v);
}

export async function DELETE(_req, ctx) {
  const { id } = await ctx.params;
  await prisma.voyage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
