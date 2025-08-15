// app/api/ai/answer/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSnapshotCached } from "@/lib/snapshot";
import { askGeminiWithRetry, isQuotaError } from "@/lib/ai";

// ---- Small helpers ----
function norm(s) { return String(s || "").trim(); }
function ok(text) { return NextResponse.json({ text }); }
function bad(msg, code = 400) { return NextResponse.json({ error: msg }, { status: code }); }

// Enhanced regex patterns
const reCity = /\b(?:shipments?|loads?)\s+(?:to|from|for|in)\s+([a-z][a-z\s-]{2,})\b/i;
const reVoyage = /\b(?:voyage(?:\s*code)?|vg)\s*([a-z]{1,6}-\d{1,6})\b/i;
const reVoyageGeneral = /\b(?:voyage|voyages)\s+(?:details?|info|information|list)\b/i;
const reVoyageFrom = /\bvoyages?\s+(?:details?|info)?\s*(?:of\s+shipments?)?\s+(?:to|from)\s+([a-z][a-z\s-]{2,})\b/i;
const reCounts = /\b(how many|count|summary|stats)\b/i;

async function answerFromDb(message) {
  // ---- City / lane first (highest priority) ----
  const mCity = message.match(reCity);
  if (mCity) {
    const token = mCity[1].trim();
    const found = await prisma.shipment.findMany({
      where: {
        OR: [
          { origin: { contains: token, mode: "insensitive" } },
          { destination: { contains: token, mode: "insensitive" } },
          { shipmentId: { contains: token, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        shipmentId: true, origin: true, destination: true,
        shipDate: true, transitDays: true, status: true, isPriority: true,
        weightTons: true, volumeM3: true,
      },
    });
    if (!found.length) return `No shipments matching "${token}".`;
    return `Shipments for "${token}" (${found.length}):\n` +
      found.map(s => `• ${s.shipmentId} ${s.origin}→${s.destination} · ${s.status} · ship ${new Date(s.shipDate).toLocaleDateString()} · ${s.transitDays}d · prio:${s.isPriority ? "Y" : "N"} · wt:${s.weightTons ?? "-"}t vol:${s.volumeM3 ?? "-"}m³`).join("\n");
  }

  // ---- Voyage details for specific city/route ----
  const mVoyFrom = message.match(reVoyageFrom);
  if (mVoyFrom) {
    const token = mVoyFrom[1].trim();
    const voyages = await prisma.voyage.findMany({
      where: {
        OR: [
          { origin: { contains: token, mode: "insensitive" } },
          { destination: { contains: token, mode: "insensitive" } },
        ],
      },
      orderBy: { departAt: "desc" },
      take: 15,
      select: {
        voyageCode: true, vesselName: true, origin: true, destination: true,
        departAt: true, arriveBy: true,
        _count: {
          select: { assignments: true }
        }
      },
    });
    
    if (!voyages.length) return `No voyages found for "${token}".`;
    
    const voyageList = voyages.map(v => 
      `• ${v.voyageCode} ${v.vesselName} · ${v.origin}→${v.destination} · ${new Date(v.departAt).toLocaleDateString()}→${new Date(v.arriveBy).toLocaleDateString()} · ${v._count.assignments} shipments`
    ).join("\n");
    
    return `Voyages for "${token}" (${voyages.length}):\n${voyageList}`;
  }

  // ---- General voyage list ----
  if (reVoyageGeneral.test(message)) {
    const voyages = await prisma.voyage.findMany({
      orderBy: { departAt: "desc" },
      take: 20,
      select: {
        voyageCode: true, vesselName: true, origin: true, destination: true,
        departAt: true, arriveBy: true,
        _count: {
          select: { assignments: true }
        }
      },
    });
    
    if (!voyages.length) return "No voyages found.";
    
    const voyageList = voyages.map(v => 
      `• ${v.voyageCode} ${v.vesselName} · ${v.origin}→${v.destination} · ${new Date(v.departAt).toLocaleDateString()}→${new Date(v.arriveBy).toLocaleDateString()} · ${v._count.assignments} shipments`
    ).join("\n");
    
    return `Recent Voyages (${voyages.length}):\n${voyageList}`;
  }

  // ---- Specific voyage by code ----
  const mVoy = message.match(reVoyage);
  if (mVoy) {
    const code = mVoy[1].toUpperCase();
    const voy = await prisma.voyage.findFirst({
      where: { voyageCode: code },
      select: {
        voyageCode: true, vesselName: true, origin: true, destination: true,
        departAt: true, arriveBy: true,
        assignments: {
          orderBy: { createdAt: "desc" },
          select: {
            shipment: {
              select: {
                shipmentId: true, origin: true, destination: true,
                shipDate: true, transitDays: true, status: true,
                weightTons: true, volumeM3: true,
              },
            },
          },
          take: 25,
        },
      },
    });
    if (!voy) return `No voyage found with code ${code}.`;
    const list = voy.assignments.map(a => a.shipment)
      .map(s => `• ${s.shipmentId} ${s.origin}→${s.destination} · ${s.status} · ${new Date(s.shipDate).toLocaleDateString()} · ${s.transitDays}d · wt:${s.weightTons ?? "-"}t vol:${s.volumeM3 ?? "-"}m³`)
      .join("\n") || "(no assigned shipments)";
    return `Voyage ${voy.voyageCode} — ${voy.vesselName}\nLane: ${voy.origin}→${voy.destination}\nWindow: ${new Date(voy.departAt).toLocaleDateString()} → ${new Date(voy.arriveBy).toLocaleDateString()}\n\nAssigned:\n${list}`;
  }

  // ---- Quick stats ----
  if (reCounts.test(message)) {
    const snap = await getSnapshotCached();
    const byStatus = Object.entries(snap.shipments.byStatus).map(([k,v]) => `${k}:${v}`).join(", ") || "none";
    const voyageStats = snap.voyages ? `\n• Total voyages: ${snap.voyages.total}\n• Active voyages: ${snap.voyages.active}` : "";
    return `Snapshot:\n• Total shipments: ${snap.shipments.total}\n• By status: ${byStatus}\n• Priority: ${snap.shipments.priorityCount}${voyageStats}`;
  }

  return null; // not handled here
}

export async function POST(req) {
  try {
    const { message, useDb } = await req.json();
    const msg = norm(message);
    if (!msg) return bad("Missing message");

    // 1) Try DB-only intents first (fast, no AI)
    const handled = await answerFromDb(msg);
    if (handled) return ok(handled);

    // 2) If client wants DB-only, return a guided summary (still no AI)
    if (useDb) {
      const snap = await getSnapshotCached();
      const byStatus = Object.entries(snap.shipments.byStatus).map(([k,v]) => `${k}:${v}`).join(", ") || "none";
      const voyageInfo = snap.voyages ? `, Voyages ${snap.voyages.total}` : "";
      return ok(
        `DB summary (no AI): Total ${snap.shipments.total}, Priority ${snap.shipments.priorityCount}, By status ${byStatus}${voyageInfo}.\n` +
        `Tip: ask "shipments to delhi", "voyage VG-100", "voyage details", or "voyages from mumbai".`
      );
    }

    // 3) Otherwise call AI with a SMALL cached context (now including voyage data)
    const snap = await getSnapshotCached();
    const prompt = `
Answer the user's logistics question using ONLY the provided JSON context when possible.
If you need specific shipment details for a city/lane or a specific voyage that's not in context, respond exactly:
"Switch to DB search mode".

USER:
${msg}

CONTEXT (JSON):
\`\`\`json
${JSON.stringify({
  version: snap.version,
  shipments: {
    total: snap.shipments.total,
    byStatus: snap.shipments.byStatus,
    priorityCount: snap.shipments.priorityCount,
    topLanes: snap.shipments.topLanes,
    recent: snap.shipments.recent, // ~15 items only
  },
  voyages: snap.voyages || null, // Include voyage data if available
}, null, 2)}
\`\`\`

Keep answers under 120 words. Prefer bullets for readability.
`.trim();

    try {
      const text = await askGeminiWithRetry(prompt);

      // If the model asks us to switch, immediately run the DB search path:
      if (/switch to db search mode/i.test(text)) {
        const fallback = await answerFromDb(msg);
        if (fallback) return ok(fallback);
        // if still nothing, return a helpful snapshot
        const byStatus = Object.entries(snap.shipments.byStatus).map(([k,v]) => `${k}:${v}`).join(", ") || "none";
        const voyageInfo = snap.voyages ? `, Voyages ${snap.voyages.total}` : "";
        return ok(
          `No direct match found. Snapshot: Total ${snap.shipments.total}, Priority ${snap.shipments.priorityCount}, By status ${byStatus}${voyageInfo}.`
        );
      }

      return ok(text);
    } catch (e) {
      if (isQuotaError(e)) {
        // graceful fallback on quota/rate limit
        const fallback = await answerFromDb(msg);
        if (fallback) return ok(fallback);
        const byStatus = Object.entries(snap.shipments.byStatus).map(([k,v]) => `${k}:${v}`).join(", ") || "none";
        const voyageInfo = snap.voyages ? `, Voyages ${snap.voyages.total}` : "";
        return ok(
          `AI quota exceeded. DB snapshot: Total ${snap.shipments.total}, Priority ${snap.shipments.priorityCount}, By status ${byStatus}${voyageInfo}.`
        );
      }
      throw e;
    }
  } catch (e) {
    console.error("POST /api/ai/answer error", e);
    return NextResponse.json({ error: e?.message || "AI answer error" }, { status: 500 });
  }
}