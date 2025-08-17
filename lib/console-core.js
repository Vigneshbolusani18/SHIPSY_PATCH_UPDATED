// lib/console-core.js
import { prisma } from "@/lib/db";
import { normalizeCity, parseWeightToTons, parseVolumeM3, resolveDateRange } from "@/lib/nlp";

const LIMITS = { list: 50, group: 200, delayed: 100, events: 50 };

const ALLOWED = {
  shipment: {
    fields: ["shipmentId","status","isPriority","origin","destination","shipDate","transitDays","weightTons","volumeM3","createdAt","updatedAt"],
    orderable: ["shipDate","createdAt","weightTons","volumeM3"],
  },
  voyage: {
    fields: ["voyageCode","vesselName","origin","destination","departAt","arriveBy","weightCapT","volumeCapM3","createdAt","updatedAt"],
    orderable: ["departAt","arriveBy","createdAt"],
  },
  tracking: {
    fields: ["eventType","location","occurredAt","createdAt"],
    orderable: ["occurredAt","createdAt"]
  }
};

function clampLimit(req, kind = "list") {
  const hard = LIMITS[kind] ?? 50;
  return Math.min(Math.max(1, req ?? 20), hard);
}

function etaFrom(shipDate, transitDays) {
  if (!shipDate || !Number.isFinite(Number(transitDays))) return null;
  const d = new Date(shipDate);
  d.setDate(d.getDate() + Number(transitDays));
  return d;
}

function applyFilterToWhere(entity, f, where) {
  const field = f.field;
  const op = f.op;
  let val = f.value;

  if (field === "origin" || field === "destination") val = normalizeCity(val);
  if (field === "weightTons") val = parseWeightToTons(val);
  if (field === "volumeM3") val = parseVolumeM3(val);

  const isDateField = ["shipDate","departAt","arriveBy","createdAt","updatedAt","occurredAt"].includes(field);
  if (isDateField) {
    if (op === "range" || op === "between") {
      const r = resolveDateRange(val);
      if (r?.from || r?.to) {
        where[field] = {};
        if (r.from) where[field].gte = r.from;
        if (r.to) where[field].lte = r.to;
        return;
      }
    }
    if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)) val = new Date(val);
  }

  switch (op) {
    case "eq": where[field] = val; break;
    case "neq": where[field] = { not: val }; break;
    case "gt": where[field] = { gt: val }; break;
    case "gte": where[field] = { gte: val }; break;
    case "lt": where[field] = { lt: val }; break;
    case "lte": where[field] = { lte: val }; break;
    case "contains": where[field] = { contains: String(val), mode: "insensitive" }; break;
    case "in": where[field] = { in: Array.isArray(val) ? val : [val] }; break;
    case "between": {
      if (Array.isArray(val) && val.length === 2) {
        const [a,b] = val;
        where[field] = { gte: new Date(a), lte: new Date(b) };
      }
      break;
    }
    default: break;
  }
}

export function validatePlan(plan) {
  const okEntity = ["shipment","voyage","tracking","kpi","plan"].includes(plan?.entity);
  if (!okEntity) return { valid:false, reason:"Unknown entity." };
  const spec = ALLOWED[plan.entity];

  for (const f of plan?.filters ?? []) {
    if (spec && !spec.fields.includes(f.field) && !(f.field === "assignments") && !(f.field === "utilization") && !(f.field==="delayed")) {
      return { valid:false, reason:`Unknown field ${f.field}` };
    }
  }
  for (const o of plan?.orderBy ?? []) {
    if (spec && !spec.orderable.includes(o.field)) {
      return { valid:false, reason:`Cannot sort by ${o.field}` };
    }
  }
  return { valid:true };
}

// --- voyage capacity helpers ---
async function computeVoyageUsage(voyageId) {
  const assigns = await prisma.voyageAssignment.findMany({
    where: { voyageId },
    include: { shipment: { select: { weightTons: true, volumeM3: true } } }
  });
  return assigns.reduce((a, r) => {
    a.weight += Number(r.shipment.weightTons ?? 0);
    a.volume += Number(r.shipment.volumeM3 ?? 0);
    return a;
  }, { weight: 0, volume: 0 });
}

// --- core planner ---
export async function planToPrisma(plan) {
  const entity = plan.entity;
  const op = plan.operation;
  const limit = clampLimit(plan.limit, (op === "delayed" ? "delayed" : "list"));

  // SHIPMENTS
  if (entity === "shipment") {
    const where = {};
    for (const f of plan.filters ?? []) applyFilterToWhere("shipment", f, where);

    if (plan.filters?.some(f => f.field === "assignments" && f.op === "eq" && f.value === "none")) {
      const rows = await prisma.shipment.findMany({
        where, orderBy: { createdAt: "desc" }, take: 200,
        include: { assignments: { select: { id: true }, take: 1 } }
      });
      const unassigned = rows.filter(r => r.assignments.length === 0).slice(0, limit);
      return { rows: unassigned, stats: { count: unassigned.length } };
    }

    if (op === "count") {
      const count = await prisma.shipment.count({ where });
      return { rows: [], stats: { count } };
    }
    if (op === "list") {
      const orderBy = (plan.orderBy ?? []).map(o => ({ [o.field]: o.dir }));
      const rows = await prisma.shipment.findMany({
        where, orderBy: orderBy.length ? orderBy : [{ createdAt: "desc" }], take: limit
      });
      return { rows, stats: { count: rows.length } };
    }
    if (op === "group") {
      const by = plan.groupBy ?? [];
      const needsCount = plan.metrics?.some(m => m.fn === "count");
      const needsSumW = plan.metrics?.some(m => m.fn === "sum" && m.field === "weightTons");
      const needsSumV = plan.metrics?.some(m => m.fn === "sum" && m.field === "volumeM3");
      const gb = await prisma.shipment.groupBy({
        by,
        where,
        _count: needsCount ? { _all: true } : undefined,
        _sum: { weightTons: needsSumW ? true : undefined, volumeM3: needsSumV ? true : undefined }
      });
      return { rows: gb.slice(0, clampLimit(limit, "group")), stats: { groups: gb.length } };
    }
    if (op === "delayed") {
      const rows = await prisma.shipment.findMany({ orderBy: { shipDate: "desc" }, take: 500 });
      const now = new Date();
      const flagged = rows.map(s => {
        const eta = etaFrom(s.shipDate, s.transitDays || 0);
        const etaPast = eta && eta < now;
        return { ...s, eta, isDelayed: etaPast && s.status !== "DELIVERED" };
      }).filter(x => x.isDelayed).slice(0, limit);
      return { rows: flagged, stats: { count: flagged.length } };
    }
  }

  // TRACKING
  if (entity === "tracking") {
    if (op === "track") {
      const code = plan?.ids?.shipmentId?.toUpperCase();
      if (!code) return { rows: [], stats: {}, error: "Missing shipmentId" };
      const s = await prisma.shipment.findFirst({ where: { shipmentId: code } });
      if (!s) return { rows: [], stats: {}, error: "Shipment not found" };
      const events = await prisma.trackingEvent.findMany({
        where: { shipmentId: s.id }, orderBy: { occurredAt: "desc" }, take: clampLimit(plan.limit, "events")
      });
      const eta = etaFrom(s.shipDate, s.transitDays || 0);
      const latest = events[0] || null;
      return { rows: [{ shipment: s, latest, events, eta }], stats: { events: events.length } };
    }
    if (op === "list") {
      const code = plan?.ids?.shipmentId?.toUpperCase();
      if (!code) return { rows: [], stats: {}, error: "Missing shipmentId" };
      const s = await prisma.shipment.findFirst({ where: { shipmentId: code } });
      if (!s) return { rows: [], stats: {}, error: "Shipment not found" };
      const events = await prisma.trackingEvent.findMany({
        where: { shipmentId: s.id }, orderBy: { occurredAt: "desc" }, take: clampLimit(plan.limit, "events")
      });
      return { rows: events, stats: { events: events.length } };
    }
  }

  // VOYAGE
  if (entity === "voyage") {
    const where = {};
    for (const f of plan.filters ?? []) applyFilterToWhere("voyage", f, where);

    if (op === "list") {
      const orderBy = (plan.orderBy ?? []).map(o => ({ [o.field]: o.dir }));
      const rows = await prisma.voyage.findMany({
        where,
        orderBy: orderBy.length ? orderBy : [{ departAt: "asc" }],
        take: limit
      });
      // optional computed utilization filter (utilization >= X)
      const utilFilter = (plan.filters || []).find(f => f.field === "utilization");
      if (utilFilter) {
        const augmented = [];
        for (const v of rows) {
          const totals = await computeVoyageUsage(v.id);
          const capW = Number(v.weightCapT ?? 0);
          const capV = Number(v.volumeCapM3 ?? 0);
          const weightPct = capW ? Math.round((totals.weight / capW) * 100) : null;
          const volumePct = capV ? Math.round((totals.volume / capV) * 100) : null;
          const util = Math.max(weightPct ?? 0, volumePct ?? 0);
          if ((utilFilter.op === "gte" && util >= utilFilter.value) || (utilFilter.op === "lte" && util <= utilFilter.value)) {
            augmented.push({ voyage: v, utilization: { weightPct, volumePct } });
          }
        }
        return { rows: augmented.slice(0, limit), stats: { count: augmented.length } };
      }
      return { rows, stats: { count: rows.length } };
    }

    if (op === "active_now") {
      const now = new Date();
      const rows = await prisma.voyage.findMany({
        where: { departAt: { lte: now }, arriveBy: { gte: now } },
        orderBy: { departAt: "asc" }, take: limit
      });
      return { rows, stats: { count: rows.length } };
    }

    if (op === "utilization" || op === "capacity_remaining") {
      const code = plan?.ids?.voyageCode?.toUpperCase();
      if (!code) return { rows: [], stats: {}, error: "Missing voyageCode" };
      const v = await prisma.voyage.findFirst({ where: { voyageCode: code } });
      if (!v) return { rows: [], stats: {}, error: "Voyage not found" };
      const totals = await computeVoyageUsage(v.id);
      const capW = Number(v.weightCapT ?? 0);
      const capV = Number(v.volumeCapM3 ?? 0);
      const remaining = { weightT: capW ? capW - totals.weight : null, volumeM3: capV ? capV - totals.volume : null };
      const util = {
        weightPct: capW ? Math.round((totals.weight / capW) * 100) : null,
        volumePct: capV ? Math.round((totals.volume / capV) * 100) : null
      };
      return { rows: [{ voyage: v, used: totals, remaining, utilization: util }], stats: {} };
    }
  }

  // PLAN — Suggest voyage assignment for a shipment
  if (entity === "plan" && op === "suggest_assignment") {
    const code = plan?.ids?.shipmentId?.toUpperCase();
    if (!code) return { rows: [], stats: {}, error: "Missing shipmentId" };

    const ship = await prisma.shipment.findFirst({ where: { shipmentId: code } });
    if (!ship) return { rows: [], stats: {}, error: "Shipment not found" };

    // Build voyage filter from plan.filters (dest, origin, date range, etc.)
    const vWhere = {};
    for (const f of plan.filters ?? []) applyFilterToWhere("voyage", f, vWhere);

    // Upcoming by default (if user didn't specify any date filter)
    if (!vWhere.departAt) vWhere.departAt = { gte: new Date() };

    const candidateVoyages = await prisma.voyage.findMany({
      where: vWhere,
      orderBy: { departAt: "asc" },
      take: 100
    });

    const rows = [];
    const wt = Number(ship.weightTons ?? 0);
    const vol = Number(ship.volumeM3 ?? 0);

    for (const v of candidateVoyages) {
      const totals = await computeVoyageUsage(v.id);
      const capW = Number(v.weightCapT ?? 0);
      const capV = Number(v.volumeCapM3 ?? 0);
      const remW = capW ? capW - totals.weight : null;
      const remV = capV ? capV - totals.volume : null;

      const fitsWeight = remW == null ? true : (wt <= remW);
      const fitsVolume = remV == null ? true : (vol <= remV);
      const fits = fitsWeight && fitsVolume;

      if (fits) {
        const weightPct = capW ? Math.round((totals.weight / capW) * 100) : null;
        const volumePct = capV ? Math.round((totals.volume / capV) * 100) : null;
        rows.push({
          voyage: v,
          canFit: true,
          remaining: { weightT: remW, volumeM3: remV },
          utilization: { weightPct, volumePct }
        });
      }
    }

    // Rank: soonest departAt, then least leftover slack (tighter pack first)
    rows.sort((a, b) => {
      const tA = new Date(a.voyage.departAt).getTime();
      const tB = new Date(b.voyage.departAt).getTime();
      if (tA !== tB) return tA - tB;
      const slackA = ((a.remaining.weightT ?? 0) + (a.remaining.volumeM3 ?? 0));
      const slackB = ((b.remaining.weightT ?? 0) + (b.remaining.volumeM3 ?? 0));
      return slackA - slackB;
    });

    return { rows: rows.slice(0, clampLimit(plan.limit)), stats: { candidates: rows.length }, context: { shipment: ship } };
  }

  // PLAN — details (which voyage is shipment on)
  if (entity === "plan" && op === "details") {
    const code = plan?.ids?.shipmentId?.toUpperCase();
    if (!code) return { rows: [], stats: {}, error: "Missing shipmentId" };
    const s = await prisma.shipment.findFirst({ where: { shipmentId: code } });
    if (!s) return { rows: [], stats: {}, error: "Shipment not found" };
    const a = await prisma.voyageAssignment.findFirst({
      where: { shipmentId: s.id },
      orderBy: { createdAt: "desc" },
      include: { voyage: true }
    });
    return { rows: [{ shipment: s, currentAssignment: a || null }], stats: {} };
  }

  // KPI stubs (we’ll serve via shipments groupBy or your snapshot layer)
  if (entity === "kpi") {
    // Reuse shipment.groupBy for now
    return { rows: [], stats: {}, info: "Use shipment.group or your snapshot API for KPIs." };
  }

  return { rows: [], stats: {}, error: "Unsupported plan." };
}
