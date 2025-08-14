// app/api/ai/answer/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { askGeminiWithRetry, isQuotaError } from '@/lib/ai';

function safeNumber(n, d = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : d;
}

// Very small “intent” helper for DB-only answers
function extractCities(text) {
  // naive split by non-letters; pick words with length >= 3
  const words = String(text || '').toLowerCase().match(/[a-z]+/g) || [];
  return Array.from(new Set(words)).filter((w) => w.length >= 3);
}

async function dbOnlyAnswer(message) {
  const cities = extractCities(message);

  // If user asked “show <city> shipments”, try lane/id filter
  if (cities.length) {
    for (const token of cities) {
      const found = await prisma.shipment.findMany({
        where: {
          OR: [
            { origin: { contains: token, mode: 'insensitive' } },
            { destination: { contains: token, mode: 'insensitive' } },
            { shipmentId: { contains: token, mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: {
          id: true,
          shipmentId: true,
          status: true,
          isPriority: true,
          origin: true,
          destination: true,
          shipDate: true,
          transitDays: true,
          weightTons: true,
          volumeM3: true,
          createdAt: true,
          assignments: {
            orderBy: { createdAt: 'desc' }, // <-- fixed (was assignedAt)
            take: 1,
            select: {
              voyage: {
                select: {
                  voyageCode: true,
                  vesselName: true,
                  origin: true,
                  destination: true,
                  departAt: true,
                  arriveBy: true,
                },
              },
            },
          },
        },
      });

      if (found.length) {
        const lines = found
          .map((s) => {
            const v = s.assignments?.[0]?.voyage;
            const vTxt = v
              ? ` · Voyage ${v.voyageCode} (${v.vesselName}) ${v.origin}→${v.destination}`
              : '';
            return `• ${s.shipmentId} — ${s.origin}→${s.destination} — ${s.status} — ship ${new Date(
              s.shipDate
            ).toLocaleDateString()} — ${s.transitDays}d — wt:${s.weightTons ?? '-'}t vol:${
              s.volumeM3 ?? '-'
            }m³${vTxt}`;
          })
          .join('\n');

        return `**Results for “${token}”** (${found.length})\n${lines}`;
      }
    }
  }

  // default snapshot if no direct match
  const [total, byStatus, priorityCount] = await Promise.all([
    prisma.shipment.count(),
    prisma.shipment.groupBy({ by: ['status'], _count: { status: true } }),
    prisma.shipment.count({ where: { isPriority: true } }),
  ]);
  const statusLine =
    byStatus.map((s) => `${s.status}:${s._count.status}`).join(', ') || 'none';

  return `I couldn’t match a city/term in your question. Quick snapshot:
• Total shipments: ${total}
• By status: ${statusLine}
• Priority: ${priorityCount}
Try: “show delhi shipments”, “shipments to mumbai”, or “SHP-001”.`;
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { message, useDb } = body || {};
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    }

    // If not grounding with DB, just proxy to Gemini (with clear quota msg)
    if (!useDb) {
      try {
        const raw = await askGeminiWithRetry(message);
        return NextResponse.json({ text: raw });
      } catch (e) {
        if (isQuotaError(e)) {
          return NextResponse.json(
            {
              text:
                "AI quota exceeded. Try again later or enable 'Use database' to get a local (non-AI) answer.",
            },
            { status: 200 }
          );
        }
        throw e;
      }
    }

    // Grounded path: try AI first, but on quota fall back to DB-only
    try {
      const [total, byStatus, priorityCount] = await Promise.all([
        prisma.shipment.count(),
        prisma.shipment.groupBy({ by: ['status'], _count: { status: true } }),
        prisma.shipment.count({ where: { isPriority: true } }),
      ]);

      const context = {
        now: new Date().toISOString(),
        shipments: {
          total,
          byStatus: Object.fromEntries(
            byStatus.map((s) => [s.status, s._count.status])
          ),
          priorityCount,
        },
      };

      const prompt = `
Answer the user's logistics question using ONLY the provided JSON context when possible.
If you need shipment details for a specific city/lane, reply: "Switch to DB search mode".

USER: ${message}

CONTEXT:
\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`
`;
      const raw = await askGeminiWithRetry(prompt);
      return NextResponse.json({ text: raw });
    } catch (e) {
      if (isQuotaError(e)) {
        const text = await dbOnlyAnswer(message);
        return NextResponse.json({ text });
      }
      throw e;
    }
  } catch (e) {
    console.error('POST /api/ai/answer error', e);
    return NextResponse.json(
      { error: e?.message || 'AI answer error' },
      { status: e?.status || 500 }
    );
  }
}
