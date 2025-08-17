// app/api/ai/ask/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { askGeminiWithRetry } from "@/lib/ai";
import {
  suggestVoyagesForShipment,
  suggestShipmentsForVoyage,
  getVoyageWithRemaining,
} from "@/lib/decide";

/* ------------------------ tiny utils ------------------------ */
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);
const fmt = (d) => {
  try {
    const x = new Date(d);
    return Number.isNaN(x.getTime()) ? String(d ?? "") : x.toISOString().slice(0, 10);
  } catch {
    return String(d ?? "");
  }
};

/* ------------------------ canonical row -> text (for the model) ------------------------ */
function textForShipment(s) {
  return [
    `Shipment ${s.shipmentId}`,
    `Status: ${s.status}`,
    `Origin: ${s.origin} → Destination: ${s.destination}`,
    `Ship Date: ${fmt(s.shipDate)}, Transit Days: ${s.transitDays}`,
    s.weightTons != null ? `Weight: ${s.weightTons} tons` : "",
    s.volumeM3 != null ? `Volume: ${s.volumeM3} m³` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
function textForVoyage(v) {
  return [
    `Voyage ${v.voyageCode} — Vessel: ${v.vesselName}`,
    `Route: ${v.origin} → ${v.destination}`,
    `Depart: ${fmt(v.departAt)}, ArriveBy: ${fmt(v.arriveBy)}`,
    v.weightCapT != null ? `Capacity: ${v.weightCapT} tons` : "",
    v.volumeCapM3 != null ? `Volume cap: ${v.volumeCapM3} m³` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ------------------------ NLU: filters + decisions ------------------------ */
function extractFilters(q) {
  const s = String(q || "");
  const lower = s.toLowerCase();

  const STOP = String.raw`(?=\s+(with|where|weight|volume|and|or|by|between|next|last|this)\b|[\s,;:]*[><=]|[\s,;:]|$)`;
  const CITY = `[a-z][a-z\\s-]{1,40}?`;
  const re = (w) => new RegExp(`\\b${w}\\s+(${CITY})${STOP}`, "i");
  const mFrom = re("from").exec(s);
  const mTo = re("to").exec(s);
  const mFor = re("for").exec(s);

  let minWeight = null,
    maxWeight = null;
  const w1 = /weight[^><=]*?(>=|>|<=|<|=)\s*([\d.]+)\s*(t|tons?|tonnes?|kg)?/i.exec(s);
  const w2 = /(>=|>|<=|<|=)\s*([\d.]+)\s*(t|tons?|tonnes?|kg)\b/i.exec(s);
  const w3 = /([\d.]+)\s*(t|tons?|tonnes?|kg)\s*(or more|\+|\bor\b\s*more)/i.exec(s);
  const asTons = (num, unit) => (unit?.toLowerCase() === "kg" ? num / 1000 : num);
  if (w3) minWeight = asTons(parseFloat(w3[1]), w3[2]);
  else if (w1 || w2) {
    const m = w1 || w2;
    const op = m[1];
    const num = parseFloat(m[2]);
    const unit = m[3];
    const v = asTons(num, unit);
    if (op === ">" || op === ">=") minWeight = v;
    else if (op === "<" || op === "<=") maxWeight = v;
    else if (op === "=") {
      minWeight = v;
      maxWeight = v;
    }
  }

  const statusMap = {
    "in transit": "IN_TRANSIT",
    "in-transit": "IN_TRANSIT",
    delivered: "DELIVERED",
    created: "CREATED",
    returned: "RETURNED",
  };
  let status = null;
  for (const k of Object.keys(statusMap)) {
    if (lower.includes(k)) {
      status = statusMap[k];
      break;
    }
  }

  const departBefore = /depart(?:ing)?\s*(?:before|by)\s*(\d{4}-\d{2}-\d{2})/i.exec(s)?.[1] || null;
  const departAfter = /depart(?:ing)?\s*(?:after|from)\s*(\d{4}-\d{2}-\d{2})/i.exec(s)?.[1] || null;
  const shipBefore = /ship(?:ped|ping)?\s*(?:before|by)\s*(\d{4}-\d{2}-\d{2})/i.exec(s)?.[1] || null;
  const shipAfter = /ship(?:ped|ping)?\s*(?:after|from)\s*(\d{4}-\d{2}-\d{2})/i.exec(s)?.[1] || null;

  const mentionVoy = /\bvoyage|voyages\b/i.test(s);
  const mentionShip = /\bshipment|shipments\b/i.test(s);

  const origin = mFrom ? mFrom[1].trim() : null;
  const destination = mTo ? mTo[1].trim() : !mTo && !mFrom && mFor ? mFor[1].trim() : null;

  return {
    origin,
    destination,
    status,
    minWeight,
    maxWeight,
    departBefore,
    departAfter,
    shipBefore,
    shipAfter,
    mentionVoy,
    mentionShip,
  };
}

function detectDecision(q) {
  const s = String(q || "").toLowerCase();
  const mShip = s.match(/\bshp[-_\s]?[a-z0-9]+/i);
  const mVoy = s.match(/\b(voy|vy|voyage)[-_]?[a-z0-9]+/i);

  if (
    /\b(best|which|suggest)\b.*\b(voyage|vessel)\b.*\bfor\b.*\b(shipment|shp[-_a-z0-9]+)/i.test(s) ||
    /\bassign\b.*\bshipment\b/i.test(s) ||
    /\bfit\b.*\bshipment\b.*\bvoyage\b/i.test(s)
  ) {
    return { kind: "suggest_voyages_for_shipment", shipmentCode: mShip?.[0] || null };
  }

  if (
    /\b(which|suggest)\b.*\bshipments?\b.*\b(voyage|vy)\b/i.test(s) ||
    /\b(fill|load|pack)\b.*\b(voyage|vy)\b/i.test(s)
  ) {
    return { kind: "suggest_shipments_for_voyage", voyageCode: mVoy?.[0]?.replace(/^(voy|vy)/i, "VOY") || null };
  }

  if (/\butili[sz]ation\b.*\b(voyage|vy)\b/i.test(s)) {
    return { kind: "voyage_utilization", voyageCode: mVoy?.[0]?.replace(/^(voy|vy)/i, "VOY") || null };
  }

  return { kind: null };
}

/* ------------------------ DB fetch (Prisma only) ------------------------ */
function buildShipmentWhere(f) {
  return {
    ...(f.origin ? { origin: { contains: f.origin, mode: "insensitive" } } : {}),
    ...(f.destination ? { destination: { contains: f.destination, mode: "insensitive" } } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.minWeight != null ? { weightTons: { gte: f.minWeight } } : {}),
    ...(f.maxWeight != null ? { weightTons: { lte: f.maxWeight } } : {}),
    ...(f.shipAfter ? { shipDate: { gte: new Date(f.shipAfter) } } : {}),
    ...(f.shipBefore ? { shipDate: { lte: new Date(f.shipBefore) } } : {}),
  };
}
function buildVoyageWhere(f) {
  return {
    ...(f.origin ? { origin: { contains: f.origin, mode: "insensitive" } } : {}),
    ...(f.destination ? { destination: { contains: f.destination, mode: "insensitive" } } : {}),
    ...(f.departAfter ? { departAt: { gte: new Date(f.departAfter) } } : {}),
    ...(f.departBefore ? { departAt: { lte: new Date(f.departBefore) } } : {}),
  };
}

/* ------------------------ main route ------------------------ */
export async function POST(req) {
  try {
    const body = await req.json();
    const q = String(body?.question || "").trim();
    if (!q) return NextResponse.json({ answer: "Please enter a question." }, { status: 400 });

    // Optional client knobs
    const LIMIT = clamp(Number(body?.limit ?? 100), 1, 500);

    // 1) Capacity/assignment decisions (deterministic)
    const decision = detectDecision(q);
    if (decision.kind === "suggest_voyages_for_shipment") {
      let code = decision.shipmentCode ? decision.shipmentCode.toUpperCase().replace(/\s+/g, "-") : null;
      let s = null;
      if (code) {
        s = await prisma.shipment.findFirst({
          where: { shipmentId: { equals: code, mode: "insensitive" } },
        });
      }
      if (!s) {
        const tok = q.match(/\bshp[-_\s]?[a-z0-9]+\b/i)?.[0]?.replace(/\s+/g, "-");
        if (tok)
          s = await prisma.shipment.findFirst({
            where: { shipmentId: { equals: tok, mode: "insensitive" } },
          });
      }
      if (!s) return NextResponse.json({ answer: "I couldn't identify the shipment. Please give a shipmentId like SHP-001." });

      const { shipment, suggestions } = await suggestVoyagesForShipment({
        shipmentIdOrCode: s.shipmentId,
        k: 15,
      });

      const rows = suggestions.map((sug) => {
        const v = sug.voyageDetail.voyage;
        const rem = sug.voyageDetail.remaining;
        return {
          voyageCode: v.voyageCode,
          vesselName: v.vesselName,
          origin: v.origin,
          destination: v.destination,
          departAt: v.departAt,
          arriveBy: v.arriveBy,
          weightCapT: v.weightCapT,
          volumeCapM3: v.volumeCapM3,
          remainingWeightT: rem.weightT,
          remainingVolumeM3: rem.volumeM3,
        };
      });

      const ctx = [
        `Shipment ${shipment.shipmentId} — ${shipment.origin}→${shipment.destination} | ship ${fmt(shipment.shipDate)} | ${shipment.weightTons ?? "?"} t, ${shipment.volumeM3 ?? "?"} m³`,
        ...rows.map(
          (r) =>
            `Voyage ${r.voyageCode} (${r.origin}→${r.destination}) depart ${fmt(r.departAt)} — remaining ${r.remainingWeightT ?? "?"} t, ${r.remainingVolumeM3 ?? "?"} m³`
        ),
      ].join("\n");

      const answer = await askGeminiWithRetry(
        `
You are Smart Freight AI. Recommend the best voyages to carry the shipment, considering remaining capacity and dates.
Explain briefly why the top 3 are good fits (capacity, timing, lane).
Return bullets + a tiny table if helpful.

CONTEXT:
${ctx}
`.trim()
      );

      return NextResponse.json({ answer, data: { rows }, plan: { entity: "voyage", operation: "list" } });
    }

    if (decision.kind === "suggest_shipments_for_voyage") {
      if (!decision.voyageCode) return NextResponse.json({ answer: "Please provide a voyage code like VOY-001." });
      const code = decision.voyageCode.toUpperCase();

      const { voyage, remainingAfter, picks } = await suggestShipmentsForVoyage({ voyageCode: code, k: 30 });
      if (!voyage) return NextResponse.json({ answer: `Voyage ${code} not found.` });

      const rows = picks.map((s) => ({
        shipmentId: s.shipmentId,
        origin: s.origin,
        destination: s.destination,
        status: s.status,
        shipDate: s.shipDate,
        weightTons: s.weightTons,
        volumeM3: s.volumeM3,
      }));

      const ctx = [
        `Voyage ${voyage.voyageCode} ${voyage.origin}→${voyage.destination} depart ${fmt(voyage.departAt)} (remaining after picks: ${remainingAfter.weightT ?? "?"} t, ${remainingAfter.volumeM3 ?? "?"} m³)`,
        ...rows.map((r) => `• ${r.shipmentId} — ${r.origin}→${r.destination} | ship ${fmt(r.shipDate)} | ${r.weightTons ?? "?"} t, ${r.volumeM3 ?? "?"} m³`),
      ].join("\n");

      const answer = await askGeminiWithRetry(
        `
You are Smart Freight AI. The list below are feasible shipments that fit the voyage capacity.
Summarize how many, total weight/volume, and any tradeoffs (priority, timing).
Recommend whether capacity is well-utilized or if more candidates are needed.

${ctx}
`.trim()
      );

      return NextResponse.json({ answer, data: { rows }, plan: { entity: "shipment", operation: "list" } });
    }

    if (decision.kind === "voyage_utilization") {
      if (!decision.voyageCode) return NextResponse.json({ answer: "Please provide a voyage code like VOY-001." });
      const detail = await getVoyageWithRemaining(decision.voyageCode.toUpperCase());
      if (!detail) return NextResponse.json({ answer: `Voyage ${decision.voyageCode} not found.` });

      const v = detail.voyage;
      const rem = detail.remaining;
      const row = {
        voyageCode: v.voyageCode,
        vesselName: v.vesselName,
        origin: v.origin,
        destination: v.destination,
        departAt: v.departAt,
        arriveBy: v.arriveBy,
        weightCapT: v.weightCapT,
        volumeCapM3: v.volumeCapM3,
        remainingWeightT: rem.weightT,
        remainingVolumeM3: rem.volumeM3,
      };
      const answer = `Voyage ${row.voyageCode} utilization — weight: ${detail.utilization.weightPct ?? "N/A"}%, volume: ${
        detail.utilization.volumePct ?? "N/A"
      }%. Remaining: ${row.remainingWeightT ?? "N/A"} t, ${row.remainingVolumeM3 ?? "N/A"} m³.`;
      return NextResponse.json({ answer, data: { rows: [row] }, plan: { entity: "voyage", operation: "utilization" } });
    }

    // 2) Regular DB Q&A (no RAG)
    const filters = extractFilters(q);

    // Special: "how many shipments and voyages"
    const asksShipCount = /\b(how many|count|number of)\b.*\bshipments?\b/i.test(q);
    const asksVoyCount = /\b(how many|count|number of)\b.*\bvoyages?\b/i.test(q);
    if (asksShipCount || asksVoyCount) {
      const whereS = buildShipmentWhere(filters);
      const whereV = buildVoyageWhere(filters);
      const [shipmentsCount, voyagesCount] = await Promise.all([
        asksShipCount ? prisma.shipment.count({ where: whereS }) : Promise.resolve(null),
        asksVoyCount ? prisma.voyage.count({ where: whereV }) : Promise.resolve(null),
      ]);

      const contextLines = [];
      if (asksShipCount) contextLines.push(`Shipments count (with filters): ${shipmentsCount}`);
      if (asksVoyCount) contextLines.push(`Voyages count (with filters): ${voyagesCount}`);

      const answer = await askGeminiWithRetry(
        `
You are Smart Freight AI. Report the counts below plainly and add one helpful sentence if appropriate.

QUESTION:
${q}

COUNTS:
${contextLines.join("\n")}
`.trim()
      );

      return NextResponse.json({
        answer,
        data: { rows: [] },
        plan: { entity: "kpi", operation: "count" },
      });
    }

    // Otherwise list shipments or voyages
    const listVoyages = filters.mentionVoy && !filters.mentionShip;
    const listShipments = filters.mentionShip || !listVoyages; // default to shipments

    if (listVoyages) {
      const where = buildVoyageWhere(filters);
      const voyages = await prisma.voyage.findMany({
        where,
        orderBy: { departAt: "desc" },
        take: LIMIT,
        include: { _count: { select: { assignments: true } } },
      });

      const rows = voyages.map((v) => ({
        id: v.id,
        type: "voyage",
        voyageCode: v.voyageCode,
        vesselName: v.vesselName,
        origin: v.origin,
        destination: v.destination,
        departAt: v.departAt,
        arriveBy: v.arriveBy,
        weightCapT: v.weightCapT,
        volumeCapM3: v.volumeCapM3,
      }));

      const ctx = voyages.map((v) => `• ${textForVoyage(v)}`).join("\n");
      const answer = await askGeminiWithRetry(
        `
You are "Smart Freight AI". Use the CONTEXT if it clearly answers; otherwise answer generally.
Be concise and precise. Show voyageCode and key dates.

QUESTION:
${q}

CONTEXT (all ${voyages.length} voyages):
${ctx || "(no rows)"}
`.trim()
      );

      return NextResponse.json({
        answer,
        data: { rows },
        plan: { entity: "voyage", operation: "list" },
      });
    }

    // list shipments (default)
    const where = buildShipmentWhere(filters);
    const shipments = await prisma.shipment.findMany({
      where,
      orderBy: { shipDate: "desc" },
      take: LIMIT,
    });

    const rows = shipments.map((s) => ({
      id: s.id,
      type: "shipment",
      shipmentId: s.shipmentId,
      status: s.status,
      origin: s.origin,
      destination: s.destination,
      shipDate: s.shipDate,
      transitDays: s.transitDays,
      weightTons: s.weightTons,
      volumeM3: s.volumeM3,
      isPriority: s.isPriority,
    }));

    const ctx = shipments.map((s) => `• ${textForShipment(s)}`).join("\n");
    const answer = await askGeminiWithRetry(
      `
You are "Smart Freight AI". Use the CONTEXT if it clearly answers; otherwise answer generally.
Be concise and precise. Show shipmentId and key dates/capacity details when relevant.

QUESTION:
${q}

CONTEXT (all ${shipments.length} shipments):
${ctx || "(no rows)"}
`.trim()
    );

    return NextResponse.json({
      answer,
      data: { rows },
      plan: { entity: "shipment", operation: "list" },
    });
  } catch (e) {
    console.error("POST /api/ai/ask error", e);
    return NextResponse.json({ answer: e?.message || "AI error" }, { status: e?.status || 500 });
  }
}