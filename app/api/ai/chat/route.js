// app/api/ai/chat/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { askGeminiWithRetry } from "@/lib/ai";
import { getSnapshotCached } from "@/lib/snapshot";

export async function POST(req) {
  try {
    const { message = "", context = null } = await req.json();

    if (!message.trim()) {
      return NextResponse.json({ text: "Please enter a question." }, { status: 400 });
    }

    // Always attach a compact snapshot so AI has something to ground answers on
    // when the user is in AI Chat mode (no DB plan/data passed).
    const snap = await getSnapshotCached();
    const safeSnap = {
      generatedAt: snap?.generatedAt || null,
      shipments: {
        total: snap?.shipments?.total ?? 0,
        byStatus: snap?.shipments?.byStatus ?? {},
        priorityCount: snap?.shipments?.priorityCount ?? 0,
        // small samples only to avoid prompt bloat
        recent: Array.isArray(snap?.shipments?.recent) ? snap.shipments.recent.slice(0, 20) : [],
        topLanes: Array.isArray(snap?.shipments?.topLanes) ? snap.shipments.topLanes.slice(0, 10) : [],
      },
      voyages: {
        total: snap?.voyages?.total ?? 0,
        active: snap?.voyages?.active ?? 0,
        recent: Array.isArray(snap?.voyages?.recent) ? snap.voyages.recent.slice(0, 20) : [],
        upcoming: Array.isArray(snap?.voyages?.upcoming) ? snap.voyages.upcoming.slice(0, 10) : [],
        topLanes: Array.isArray(snap?.voyages?.topLanes) ? snap.voyages.topLanes.slice(0, 10) : [],
      },
    };

    // If the front-end passed a last-DB-result context, include it too.
    // This helps for grounded follow-ups like “should I choose this voyage for this shipment…?”
    const mergedContext = {
      snapshot: safeSnap,
      previousDbContext: context ?? null,
    };

    const system = `
You are "Smart Freight Advisor".
- Be concise and practical.
- Ground answers ONLY in the provided CONTEXT (snapshot + previous DB context if any).
- If a needed fact is missing from CONTEXT, say what is missing and suggest the exact follow-up query.
- Mark any guess with "Assumption".
- Never invent IDs, dates, weights, volumes, or counts not present in CONTEXT.
`.trim();

    const prompt = `
${system}

USER QUESTION:
${message}

CONTEXT (JSON):
${JSON.stringify(mergedContext, null, 2)}

Write the best short answer grounded ONLY in the CONTEXT above.
`.trim();

    const text = await askGeminiWithRetry(prompt, {
      model: "gemini-1.5-flash",
      maxRetries: 1,
    });

    return NextResponse.json({ text, plan: null, data: { context: mergedContext } });
  } catch (e) {
    // If quota/key issues, your lib/ai.js throws with a clear message & status
    return NextResponse.json(
      { text: e?.message || "AI chat error" },
      { status: e?.status || 500 }
    );
  }
}
