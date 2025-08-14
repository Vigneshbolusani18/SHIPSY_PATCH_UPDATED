// app/api/voyages/[id]/plan/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { askGeminiWithRetry } from '@/lib/ai';

export async function POST(req, ctx) {
  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const doCommit = searchParams.get('commit') === 'true';

  const voyage = await prisma.voyage.findUnique({ where: { id } });
  if (!voyage) return NextResponse.json({ error: 'Voyage not found' }, { status: 404 });

  // Candidate shipments: not already assigned to this voyage
  const candidates = await prisma.shipment.findMany({
    where: { assignments: { none: { voyageId: id } } },
    orderBy: { createdAt: 'asc' },
  });

  const weightCap = voyage.weightCapT ?? Number.POSITIVE_INFINITY;
  const volumeCap = voyage.volumeCapM3 ?? Number.POSITIVE_INFINITY;

  const score = s => {
    const wr = (s.weightTons ?? 0) / (weightCap || 1);
    const vr = (s.volumeM3 ?? 0) / (volumeCap || 1);
    const a = 0.6;
    return a*wr + (1-a)*vr + (s.isPriority ? 0.5 : 0);
  };

  const sorted = [...candidates].sort((a,b) => score(b) - score(a));
  let w = 0, v = 0;
  const assigned = [];
  const skipped = [];
  for (const s of sorted) {
    const sw = s.weightTons ?? 0;
    const sv = s.volumeM3 ?? 0;
    if (w + sw <= weightCap && v + sv <= volumeCap) {
      assigned.push(s);
      w += sw; v += sv;
    } else {
      skipped.push({ s, reason: 'Capacity' });
    }
  }

  const util = {
    weight: weightCap && weightCap !== Infinity ? Math.round((w/weightCap)*100) : null,
    volume: volumeCap && volumeCap !== Infinity ? Math.round((v/volumeCap)*100) : null,
  };

  const rows = candidates.map(s =>
    `- ${s.shipmentId} prio=${s.isPriority?'Y':'N'} ${s.origin}→${s.destination} wt=${s.weightTons??'-'}t vol=${s.volumeM3??'-'}m³`
  ).join('\n');

  const prompt = `
You are a voyage planner. Given the capacity and candidate shipments, propose a loading order and note any skips (with reasons).
Return short markdown:
- Suggested loading order (by shipmentId)
- Likely skips (shipmentId + reason)
- One tip to improve utilization or reduce delays

Capacity:
- weightCapT: ${voyage.weightCapT ?? 'NA'}
- volumeCapM3: ${voyage.volumeCapM3 ?? 'NA'}

Candidates:
${rows || '(none)'}
`.trim();

  let hint = '';
  try {
    hint = await askGeminiWithRetry({
      prompt,
      primary: 'gemini-1.5-flash',
      fallback: 'gemini-1.5-flash-8b',
    });
  } catch (e) {
    hint = 'AI unavailable right now. Showing deterministic (FFD) plan only.';
  }

  if (doCommit && assigned.length) {
    await prisma.voyageAssignment.createMany({
      data: assigned.map(s => ({ voyageId: id, shipmentId: s.id })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json({
    hint,
    utilization: util,
    assigned: assigned.map(s => s.shipmentId),
    skipped: skipped.map(x => ({ shipmentId: x.s.shipmentId, reason: x.reason })),
    committed: doCommit,
  });
}
