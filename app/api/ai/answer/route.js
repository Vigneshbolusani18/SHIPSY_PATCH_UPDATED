// app/api/ai/answer/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { askGeminiJSON } from "@/lib/ai";
import { buildIntentPrompt } from "@/lib/prompt-catalog";
import { validatePlan, planToPrisma } from "@/lib/console-core";
import { getSnapshotCached } from "@/lib/snapshot";

// ---------- tiny utils ----------
function fmtDate(d) { try { return new Date(d).toISOString().slice(0,10); } catch { return String(d); } }
function plural(n, w) { return `${n} ${w}${n === 1 ? "" : "s"}`; }
function norm(s) { return String(s || "").trim(); }

// ---------- detect “help / what info do you have?” ----------
function isGenericInfoQuery(q) {
  const s = q.toLowerCase();
  return (
    /^(what (info|information) do (you|u) have)\b/.test(s) ||
    /\bwhat can (you|u) do\b/.test(s) ||
    /\bcapabilit(y|ies)\b/.test(s) ||
    /\b(help|how to ask|how do i use)\b/.test(s)
  );
}

// ---------- RULE-BASED FALLBACK PARSER (no LLM) ----------
/**
 * We only changed:
 *  - city lookahead to stop before depart/arrival/date words
 *  - voyage date parsing (depart/arrival + bare before/after/on/by/between)
 *  - shipment absolute shipDate parsing
 */
function rulePlan(message) {
  const q = norm(message);
  if (!q) return null;
  const lower = q.toLowerCase();

  const mentionsVoyage   = /\bvoyage|voyages\b/.test(lower);
  const mentionsShipment = /\bshipment|shipments\b/.test(lower) || !mentionsVoyage;
  const isCount = /\bhow many\b|\bcount\b|\bnumber of\b/.test(lower);

  // ---- weight parsing (unchanged) ----
  let weight = null;
  const w1 = /weight[^><=]*?(>=|>|<=|<|=)\s*([\d.]+)\s*(t|tons?|tonnes?|kg)?/i.exec(q);
  const w2 = /(>=|>|<=|<|=)\s*([\d.]+)\s*(t|tons?|tonnes?|kg)\b/i.exec(q);
  const w3 = /([\d.]+)\s*(t|tons?|tonnes?|kg)\s*(or more|\+|\bor\b\s*more)/i.exec(q);
  if (w1 || w2 || w3) {
    let op, num, unit;
    if (w3) { op = ">="; num = parseFloat(w3[1]); unit = w3[2]; }
    else    { op = (w1 || w2)[1]; num = parseFloat((w1 || w2)[2]); unit = (w1 || w2)[3]; }
    unit = (unit || "t").toLowerCase();
    const tons = unit === "kg" ? num / 1000 : num;
    weight = { op, value: tons };
  }

  // ---- NEW volume parsing (m3 / m^3 / m³; plus worded ops) ----
  let volume = null;
  const volUnit = "(m\\^?3|m³|m3)";
  const v1 = new RegExp(`\\bvol(?:ume)?[^><=]*?(>=|>|<=|<|=)\\s*([\\d.]+)\\s*${volUnit}?\\b`, "i").exec(q);
  const v2 = new RegExp(`\\b(>=|>|<=|<|=)\\s*([\\d.]+)\\s*${volUnit}\\b`, "i").exec(q);
  const v3 = new RegExp(`\\b([\\d.]+)\\s*${volUnit}\\s*(or\\s*more|\\+|\\bor\\s*more\\b)`, "i").exec(q);
  const vWords = new RegExp(
    `\\bvol(?:ume)?\\s*(less\\s*than|greater\\s*than|more\\s*than|at\\s*least|at\\s*most|no\\s*more\\s*than|no\\s*less\\s*than)\\s*([\\d.]+)\\s*(?:${volUnit})?\\b`,
    "i"
  ).exec(q);
  if (v1 || v2 || v3 || vWords) {
    let op, num;
    if (v3) { op = ">="; num = parseFloat(v3[1]); }
    else if (v1 || v2) { const m = v1 || v2; op = m[1]; num = parseFloat(m[2]); }
    else if (vWords) {
      const phr = vWords[1].toLowerCase().replace(/\s+/g, " ");
      const mapWords = {
        "less than": "<",
        "greater than": ">",
        "more than": ">",
        "at least": ">=",
        "at most": "<=",
        "no more than": "<=",
        "no less than": ">=",
      };
      op = mapWords[phr] || ">=";
      num = parseFloat(vWords[2]);
    }
    volume = { op, value: num };
  }

  // ---- city parsing with lookahead guards (ADDED: depart/arrival/date words) ----
  const toStop = "(?=\\s+(with|where|weight|volume|and|depart|departure|departing|departs|arrive|arrival|arriving|arrivals|by|before|after|on|between)\\b|\\s*,|$)";
  const mFrom = new RegExp(`\\bfrom\\s+([a-z][a-z\\s-]{1,40}?)${toStop}`, "i").exec(q);
  const mTo   = new RegExp(`\\bto\\s+([a-z][a-z\\s-]{1,40}?)${toStop}`, "i").exec(q);
  const mFor  = new RegExp(`\\bfor\\s+([a-z][a-z\\s-]{1,40}?)${toStop}`, "i").exec(q);

  // ---- date-like phrases ----
  // Relative windows (unchanged)
  const next30 = /\bnext\s*30\s*days?\b/i.test(lower);
  const next60 = /\bnext\s*60\s*days?\b/i.test(lower);
  const last7  = /\blast\s*7\s*days?\b/i.test(lower);
  const last14 = /\blast\s*14\s*days?\b/i.test(lower);
  const thisMonth  = /\bthis\s*month\b/i.test(lower);
  const lastMonth  = /\blast\s*month\b/i.test(lower);

  // Voyages: DEPART* phrases (added s/ed variants)
  const departBefore     = /\bdepart(?:ure|ing|s|ed)?\s*before\s*(\d{4}-\d{2}-\d{2})/i.exec(q);
  const departAfter      = /\bdepart(?:ure|ing|s|ed)?\s*after\s*(\d{4}-\d{2}-\d{2})/i.exec(q);
  const departOn         = /\bdepart(?:ure|ing|s|ed)?\s*on\s*(\d{4}-\d{2}-\d{2})/i.exec(q);
  const departBy         = /\bdepart(?:ure|ing|s|ed)?\s*by\s*(\d{4}-\d{2}-\d{2})/i.exec(q);
  const departOnOrBefore = /\bdepart(?:ure|ing|s|ed)?\s*on\s*or\s*before\s*(\d{4}-\d{2}-\d{2})/i.exec(q);
  const departOnOrAfter  = /\bdepart(?:ure|ing|s|ed)?\s*on\s*or\s*after\s*(\d{4}-\d{2}-\d{2})/i.exec(q);
  const departBetween    = /depart(?:ure|ing|s|ed)?\s*between\s*(\d{4}-\d{2}-\d{2})\s*(?:and|to|-)\s*(\d{4}-\d{2}-\d{2})/i.exec(q);

  // Voyages: ARRIVE* phrases (added als/ed)
  const arriveBefore     = /\barriv(?:e|al|ing|als|ed)?\s*before\s*(\d{4}-\d{2}-\d{2})/i.exec(q);
  const arriveAfter      = /\barriv(?:e|al|ing|als|ed)?\s*after\s*(\d{4}-\d{2}-\d{2})/i.exec(q);
  const arriveOn         = /\barriv(?:e|al|ing|als|ed)?\s*on\s*(\d{4}-\d{2}-\d{2})/i.exec(q);
  const arriveBy         = /\barriv(e|ing)\s*by\s*(\d{4}-\d{2}-\d{2})/i.exec(q); // keep your original (date = [2])
  const arriveOnOrBefore = /\barriv(?:e|al|ing|als|ed)?\s*on\s*or\s*before\s*(\d{4}-\d{2}-\d{2})/i.exec(q);
  const arriveOnOrAfter  = /\barriv(?:e|al|ing|als|ed)?\s*on\s*or\s*after\s*(\d{4}-\d{2}-\d{2})/i.exec(q);
  const arriveBetween    = /arriv(?:e|al|ing|als|ed)?\s*between\s*(\d{4}-\d{2}-\d{2})\s*(?:and|to|-)\s*(\d{4}-\d{2}-\d{2})/i.exec(q);

  // Voyages: bare date phrases (no depart/arrival keyword)
  const bareBefore     = /\bbefore\s*(\d{4}-\d{2}-\d{2})\b/i.exec(q);
  const bareAfter      = /\bafter\s*(\d{4}-\d{2}-\d{2})\b/i.exec(q);
  const bareOn         = /\bon\s*(\d{4}-\d{2}-\d{2})\b/i.exec(q);
  const bareBy         = /\bby\s*(\d{4}-\d{2}-\d{2})\b/i.exec(q);
  const bareOnOrBefore = /\bon\s*or\s*before\s*(\d{4}-\d{2}-\d{2})\b/i.exec(q);
  const bareOnOrAfter  = /\bon\s*or\s*after\s*(\d{4}-\d{2}-\d{2})\b/i.exec(q);
  const bareBetween    = /(?:between|from)\s*(\d{4}-\d{2}-\d{2})\s*(?:and|to|-)\s*(\d{4}-\d{2}-\d{2})/i.exec(q);

  // Shipments: absolute shipDate phrases
  const shipBefore       = /\bbefore\s*(\d{4}-\d{2}-\d{2})\b/i.exec(q);
  const shipAfter        = /\bafter\s*(\d{4}-\d{2}-\d{2})\b/i.exec(q);
  const shipOn           = /\bon\s*(\d{4}-\d{2}-\d{2})\b/i.exec(q);
  const shipBy           = /\bby\s*(\d{4}-\d{2}-\d{2})\b/i.exec(q);
  const shipOnOrBefore   = /\bon\s*or\s*before\s*(\d{4}-\d{2}-\d{2})\b/i.exec(q);
  const shipOnOrAfter    = /\bon\s*or\s*after\s*(\d{4}-\d{2}-\d{2})\b/i.exec(q);
  const shipBetween      = /(?:between|from)\s*(\d{4}-\d{2}-\d{2})\s*(?:and|to|-)\s*(\d{4}-\d{2}-\d{2})/i.exec(q);

  // ---- status parsing (unchanged) ----
  const statusMap = { "in transit":"IN_TRANSIT", "in-transit":"IN_TRANSIT", "delivered":"DELIVERED", "created":"CREATED", "returned":"RETURNED" };
  let status = null;
  for (const k of Object.keys(statusMap)) { if (lower.includes(k)) { status = statusMap[k]; break; } }

  // ---- build filters ----
  const filters = [];
  if (mFrom) filters.push({ field: "origin",      op: "contains", value: mFrom[1].trim() });
  if (mTo)   filters.push({ field: "destination", op: "contains", value: mTo[1].trim() });
  if (!mTo && !mFrom && mFor) filters.push({ field: "destination", op: "contains", value: mFor[1].trim() });

  if (mentionsShipment && status) filters.push({ field: "status", op: "eq", value: status });
  if (mentionsShipment && weight) {
    const map = { ">": "gt", ">=": "gte", "<": "lt", "<=": "lte", "=": "eq" };
    filters.push({ field: "weightTons", op: map[weight.op] || "gte", value: weight.value });
  }

  // ---- NEW volume filter ----
  if (mentionsShipment && volume) {
    const map = { ">": "gt", ">=": "gte", "<": "lt", "<=": "lte", "=": "eq" };
    filters.push({ field: "volumeM3", op: map[volume.op] || "gte", value: volume.value });
  }

  // ---- voyages vs shipments ----
  if (mentionsVoyage) {
    // Prefer explicit DEPART/ARRIVE constraints
    if (departBetween)    filters.push({ field: "departAt", op: "between", value: [departBetween[1], departBetween[2]] });
    if (departOn)         filters.push({ field: "departAt", op: "eq",  value: departOn[1] });
    if (departBefore)     filters.push({ field: "departAt", op: "lt",  value: departBefore[1] });
    if (departAfter)      filters.push({ field: "departAt", op: "gt",  value: departAfter[1] });
    if (departBy)         filters.push({ field: "departAt", op: "lte", value: departBy[1] });
    if (departOnOrBefore) filters.push({ field: "departAt", op: "lte", value: departOnOrBefore[1] });
    if (departOnOrAfter)  filters.push({ field: "departAt", op: "gte", value: departOnOrAfter[1] });

    if (arriveBetween)    filters.push({ field: "arriveBy", op: "between", value: [arriveBetween[1], arriveBetween[2]] });
    if (arriveOn)         filters.push({ field: "arriveBy", op: "eq",  value: arriveOn[1] });
    if (arriveBefore)     filters.push({ field: "arriveBy", op: "lt",  value: arriveBefore[1] });
    if (arriveAfter)      filters.push({ field: "arriveBy", op: "gt",  value: arriveAfter[1] });
    if (arriveBy)         filters.push({ field: "arriveBy", op: "lte", value: arriveBy[2] });
    if (arriveOnOrBefore) filters.push({ field: "arriveBy", op: "lte", value: arriveOnOrBefore[1] });
    if (arriveOnOrAfter)  filters.push({ field: "arriveBy", op: "gte", value: arriveOnOrAfter[1] });

    // If user wrote bare before/after/on/by/between:
    const mentionsArrivalWord = /\barriv(e|al|ing|als|ed)\b/i.test(lower);
    const bareTarget = mentionsArrivalWord ? "arriveBy" : "departAt";
    if (!departBefore && !departAfter && !departOn && !departBy && !departOnOrBefore && !departOnOrAfter &&
        !arriveBefore && !arriveAfter && !arriveOn && !arriveBy && !arriveOnOrBefore && !arriveOnOrAfter &&
        !arriveBetween && !departBetween) {
      if (bareBetween)    filters.push({ field: bareTarget, op: "between", value: [bareBetween[1], bareBetween[2]] });
      if (bareOn)         filters.push({ field: bareTarget, op: "eq",  value: bareOn[1] });
      if (bareBefore)     filters.push({ field: bareTarget, op: "lt",  value: bareBefore[1] });
      if (bareAfter)      filters.push({ field: bareTarget, op: "gt",  value: bareAfter[1] });
      if (bareBy)         filters.push({ field: bareTarget, op: "lte", value: bareBy[1] });
      if (bareOnOrBefore) filters.push({ field: bareTarget, op: "lte", value: bareOnOrBefore[1] });
      if (bareOnOrAfter)  filters.push({ field: bareTarget, op: "gte", value: bareOnOrAfter[1] });
    }

    // Relative ranges
    if (next30)        filters.push({ field: "departAt", op: "range", value: "next_30d" });
    if (next60)        filters.push({ field: "departAt", op: "range", value: "next_60d" });
    if (thisMonth)     filters.push({ field: "departAt", op: "range", value: "this_month" });
    if (lastMonth)     filters.push({ field: "departAt", op: "range", value: "last_month" });

    return {
      entity: "voyage",
      operation: "list",
      filters,
      orderBy: [{ field: "departAt", dir: "asc" }],
      limit: 50
    };
  }

  // shipments: relative windows
  if (last7)      filters.push({ field: "shipDate", op: "range", value: "last_7d" });
  if (last14)     filters.push({ field: "shipDate", op: "range", value: "last_14d" });
  if (thisMonth)  filters.push({ field: "shipDate", op: "range", value: "this_month" });
  if (lastMonth)  filters.push({ field: "shipDate", op: "range", value: "last_month" });

  // shipments: absolute ship date filters
  if (shipBetween)    filters.push({ field: "shipDate", op: "between", value: [shipBetween[1], shipBetween[2]] });
  if (shipOn)         filters.push({ field: "shipDate", op: "eq",  value: shipOn[1] });
  if (shipBefore)     filters.push({ field: "shipDate", op: "lt",  value: shipBefore[1] });
  if (shipAfter)      filters.push({ field: "shipDate", op: "gt",  value: shipAfter[1] });
  if (shipBy)         filters.push({ field: "shipDate", op: "lte", value: shipBy[1] });
  if (shipOnOrBefore) filters.push({ field: "shipDate", op: "lte", value: shipOnOrBefore[1] });
  if (shipOnOrAfter)  filters.push({ field: "shipDate", op: "gte", value: shipOnOrAfter[1] });

  return {
    entity: "shipment",
    operation: isCount ? "count" : "list",
    filters,
    orderBy: [{ field: "shipDate", dir: "desc" }],
    limit: isCount ? 20 : 50
  };
}

// ---------- capabilities (help) ----------
function renderCapabilities(snapshot) {
  const s = snapshot || {};
  const sh = s.shipments || {};
  const vo = s.voyages || {};

  const byStatus = sh.byStatus || {};
  const statusLines = Object.keys(byStatus).length
    ? Object.entries(byStatus).map(([k,v]) => `  - ${k}: ${v}`).join("\n")
    : "  - (no data)";

  const topShipmentLanes = (sh.topLanes || []).slice(0,5).map(l => `  - ${l.lane} (${l.count})`).join("\n") || "  - (no data)";
  const topVoyageLanes   = (vo.topLanes || []).slice(0,5).map(l => `  - ${l.lane} (${l.count})`).join("\n") || "  - (no data)";

  return [
    "I can answer logistics questions using your live DB, including:",
    "",
    "• Shipments",
    "  - Count/list by origin/destination/status/priority",
    "  - Weight/volume filters (e.g., weight ≥ 2 t, volume ≥ 50 m³)",
    "  - Date windows (last_7d, this_month, between YYYY-MM-DD…) and absolute dates",
    "  - Tracking & delayed detection",
    "",
    "• Voyages",
    "  - List by lane + date windows",
    "  - Utilization & remaining capacity (weight & volume)",
    "  - Find voyages that can fit a shipment",
    "",
    "Current KPIs (snapshot):",
    `  Shipments total: ${sh.total ?? 0}`,
    "  By status:",
    statusLines,
    `  Priority: ${sh.priorityCount ?? 0}`,
    "  Top shipment lanes:",
    topShipmentLanes,
    `  Voyages total: ${vo.total ?? 0} | Active now: ${vo.active ?? 0}`,
    "  Top voyage lanes:",
    topVoyageLanes,
  ].join("\n");
}

// ---------- deterministic renderer ----------
function renderAnswer(plan, result) {
  const { rows, stats, error, context } = result || {};
  if (error) return `Error: ${error}`;

  const ent = plan.entity, op = plan.operation;

  if (ent === "shipment" && op === "count") {
    return `Count: ${stats?.count ?? 0}`;
  }
  if (ent === "shipment" && op === "list") {
    if (!rows?.length) return "No shipments found.";
    const head = rows.slice(0, Math.min(rows.length, 5)).map(s =>
      `• ${s.shipmentId} — ${s.origin}→${s.destination} | ${s.status} | ship ${fmtDate(s.shipDate)} | ${s.weightTons ?? "?"} t, ${s.volumeM3 ?? "?"} m³`
    ).join("\n");
    const more = rows.length > 5 ? `\n…+${rows.length-5} more` : "";
    return `Found ${plural(rows.length,"shipment")}:\n${head}${more}`;
  }
  if (ent === "voyage" && op === "list") {
    if (!rows?.length) return "No voyages found.";
    const lines = rows.slice(0, 10).map(v =>
      `• ${v.voyageCode} — ${v.origin}→${v.destination} | depart ${fmtDate(v.departAt)} | arrive ${fmtDate(v.arriveBy)}`
    ).join("\n");
    const more = rows.length > 10 ? `\n…+${rows.length-10} more` : "";
    return `Found ${plural(rows.length,"voyage")}:\n${lines}${more}`;
  }
  if (ent === "tracking" && (op === "track" || op === "list")) {
    if (!rows?.length) return "No tracking data.";
    if (op === "track") {
      const r = rows[0];
      const s = r.shipment;
      const latest = r.latest;
      const eta = r.eta ? fmtDate(r.eta) : "N/A";
      return `Shipment ${s.shipmentId}: ${s.origin}→${s.destination} | ${s.status} | ETA ${eta}` +
             (latest ? `\nLatest: ${latest.eventType} at ${latest.location} on ${fmtDate(latest.occurredAt)}` : "");
    } else {
      const lines = rows.map(e => `• ${e.eventType} at ${e.location} on ${fmtDate(e.occurredAt)}`).join("\n");
      return `Events (${rows.length}):\n${lines}`;
    }
  }
  if (ent === "voyage" && (op === "utilization" || op === "capacity_remaining")) {
    const r = rows?.[0];
    if (!r) return "Voyage not found.";
    const v = r.voyage;
    const u = r.utilization || {};
    const rem = r.remaining || {};
    const w = u.weightPct != null ? `${u.weightPct}%` : "N/A";
    const vol = u.volumePct != null ? `${u.volumePct}%` : "N/A";
    const rw = rem.weightT != null ? `${rem.weightT.toFixed(2)} t` : "N/A";
    const rv = rem.volumeM3 != null ? `${rem.volumeM3.toFixed(2)} m³` : "N/A";
    return `Voyage ${v.voyageCode} utilization — weight: ${w}, volume: ${vol}. Remaining: ${rw}, ${rv}.`;
  }
  if (ent === "plan" && op === "suggest_assignment") {
    if (!rows?.length) return "No suitable voyages found.";
    const s = context?.shipment;
    const header = s ? `Shipment ${s.shipmentId} (${s.weightTons ?? "?"} t, ${s.volumeM3 ?? "?"} m³):\n` : "";
    const lines = rows.slice(0, 10).map(r => {
      const v = r.voyage;
      const rem = r.remaining || {};
      const rw = rem.weightT != null ? `${rem.weightT.toFixed(2)} t` : "N/A";
      const rv = rem.volumeM3 != null ? `${rem.volumeM3.toFixed(2)} m³` : "N/A";
      return `• ${v.voyageCode} — ${v.origin}→${v.destination} | depart ${fmtDate(v.departAt)} | remaining ${rw}, ${rv}`;
    }).join("\n");
    const more = rows.length > 10 ? `\n…+${rows.length-10} more` : "";
    return `${header}${lines}${more}`;
  }
  if (ent === "plan" && op === "details") {
    const r = rows?.[0];
    if (!r) return "Shipment not found.";
    if (!r.currentAssignment) return `Shipment ${r.shipment.shipmentId} is not assigned to any voyage.`;
    const v = r.currentAssignment.voyage;
    return `Shipment ${r.shipment.shipmentId} is on voyage ${v.voyageCode} (${v.origin}→${v.destination}), depart ${fmtDate(v.departAt)}, arrive ${fmtDate(v.arriveBy)}.`;
  }

  return "I produced data, but no renderer matched this operation.";
}

// ---------- ROUTE ----------
export async function POST(req) {
  try {
    const body = await req.json();
    const message = String(body?.message || "");
    const useDbRaw = body?.useDb;
    const useDb = (typeof useDbRaw === "boolean")
      ? useDbRaw
      : (String(useDbRaw).toLowerCase() === "true" || String(useDbRaw) === "1");

    if (!message.trim()) {
      return NextResponse.json({ text: "Please enter a question." }, { status: 400 });
    }

    if (!useDb) {
      return NextResponse.json({
        text: "Database access is disabled. Enable “Use database” to answer from real data.",
        debug: { receivedUseDb: useDbRaw }
      });
    }

    // “help / what info do you have”
    if (isGenericInfoQuery(message)) {
      const snapshot = await getSnapshotCached();
      const text = renderCapabilities(snapshot);
      return NextResponse.json({
        text,
        data: { snapshot },
        plan: { entity: "help", operation: "capabilities" }
      });
    }

    // 1) Rules first
    let plan = rulePlan(message);

    // 2) Fallback to Gemini JSON
    if (!plan) {
      const prompt = buildIntentPrompt(message);
      plan = await askGeminiJSON(prompt, { model: "gemini-1.5-flash", maxRetries: 1 });
    }

    // 3) Guardrails
    const ok = validatePlan(plan);
    if (!ok.valid) {
      return NextResponse.json({ text: `I can't run that: ${ok.reason}`, plan }, { status: 400 });
    }

    // 4) Execute
    const result = await planToPrisma(plan);

    // 5) Deterministic answer
    const text = renderAnswer(plan, result);

    return NextResponse.json({ text, plan, data: result });
  } catch (e) {
    console.error("POST /api/ai/answer error", e);
    return NextResponse.json({ text: e?.message || "AI answer error" }, { status: e?.status || 500 });
  }
}
