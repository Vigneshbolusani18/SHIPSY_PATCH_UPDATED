// lib/snapshot.js
import { prisma } from "@/lib/db";

/**
 * In-memory cache (per server instance). If you're on Vercel serverless,
 * each lambda instance will keep its own cache which is fine for a short TTL.
 */
let cachedSnapshot = null;
let cacheAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Small helpers */
function safeDate(d) {
  try { return d ? new Date(d) : null; } catch { return null; }
}
function toISODate(d) {
  try { return new Date(d).toISOString(); } catch { return null; }
}

/**
 * Build a map of voyage usage (sum of shipment weights/volumes) in ONE pass
 * for a given set of voyage ids. This avoids N+1 queries.
 */
async function buildVoyageUsageMap(voyageIds) {
  if (!voyageIds.length) return new Map();

  // Pull assignments (limited to these voyages) with shipment weights/volumes
  const assigns = await prisma.voyageAssignment.findMany({
    where: { voyageId: { in: voyageIds } },
    select: {
      voyageId: true,
      shipment: { select: { weightTons: true, volumeM3: true } },
    },
  }).catch(() => []);

  // Reduce to totals per voyageId
  const usage = new Map(); // voyageId -> { weight, volume }
  for (const a of assigns) {
    const w = Number(a.shipment?.weightTons ?? 0);
    const v = Number(a.shipment?.volumeM3 ?? 0);
    const prev = usage.get(a.voyageId) || { weight: 0, volume: 0 };
    prev.weight += Number.isFinite(w) ? w : 0;
    prev.volume += Number.isFinite(v) ? v : 0;
    usage.set(a.voyageId, prev);
  }
  return usage;
}

/**
 * Main snapshot maker (cached).
 */
export async function getSnapshotCached() {
  const nowMs = Date.now();
  if (cachedSnapshot && nowMs - cacheAt < CACHE_TTL_MS) {
    return cachedSnapshot;
  }

  try {
    // ---- 1) Shipments (limited for snapshot size) ----
    const shipments = await prisma.shipment.findMany({
      select: {
        shipmentId: true,
        origin: true,
        destination: true,
        status: true,
        isPriority: true,
        shipDate: true,
        transitDays: true,
        weightTons: true,
        volumeM3: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 1000, // keep snapshot light
    }).catch(() => []);

    // Basic shipment metrics
    const statusCounts = {};
    const laneCounts = {};
    let priorityCount = 0;

    for (const s of shipments) {
      const status = s?.status || "UNKNOWN";
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      if (s?.isPriority) priorityCount++;

      const lane = `${s?.origin || "Unknown"}→${s?.destination || "Unknown"}`;
      laneCounts[lane] = (laneCounts[lane] || 0) + 1;
    }

    const topShipmentLanes = Object.entries(laneCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([lane, count]) => ({ lane, count }));

    const recentShipments = shipments.slice(0, 15).map((s) => ({
      shipmentId: s?.shipmentId || "N/A",
      lane: `${s?.origin || "Unknown"}→${s?.destination || "Unknown"}`,
      status: s?.status || "UNKNOWN",
      isPriority: Boolean(s?.isPriority),
      shipDate: s?.shipDate || null,
      transitDays: Number(s?.transitDays || 0),
      weightTons: s?.weightTons ?? null,
      volumeM3: s?.volumeM3 ?? null,
    }));

    // ---- 2) Voyages (include capacity columns) ----
    const voyages = await prisma.voyage.findMany({
      select: {
        id: true,
        voyageCode: true,
        vesselName: true,
        origin: true,
        destination: true,
        departAt: true,
        arriveBy: true,
        weightCapT: true,
        volumeCapM3: true,
        _count: { select: { assignments: true } },
      },
      orderBy: { departAt: "desc" },
      take: 100, // limit to avoid huge snapshots
    }).catch(() => []);

    // One-pass usage map (sum of assigned shipment weights/volumes per voyage)
    const voyageIds = voyages.map((v) => v.id);
    const usageMap = await buildVoyageUsageMap(voyageIds);

    // Compute extra voyage metrics
    const now = new Date();
    const activeVoyagesCount = voyages.reduce((acc, v) => {
      const dep = safeDate(v?.departAt);
      const arr = safeDate(v?.arriveBy);
      if (dep && arr && dep <= now && arr >= now) return acc + 1;
      return acc;
    }, 0);

    // Top voyage lanes by count (how many voyages per lane in the window)
    const voyageLaneCounts = {};
    for (const v of voyages) {
      const lane = `${v?.origin || "Unknown"}→${v?.destination || "Unknown"}`;
      voyageLaneCounts[lane] = (voyageLaneCounts[lane] || 0) + 1;
    }
    const topVoyageLanes = Object.entries(voyageLaneCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([lane, count]) => ({ lane, count }));

    // Enrich recentVoyages (most recent departures)
    const recentVoyages = voyages.slice(0, 15).map((v) => {
      const used = usageMap.get(v.id) || { weight: 0, volume: 0 };
      const capW = Number(v?.weightCapT ?? 0);
      const capV = Number(v?.volumeCapM3 ?? 0);

      const remaining = {
        weightT: capW ? capW - used.weight : null,
        volumeM3: capV ? capV - used.volume : null,
      };

      const utilization = {
        weightPct: capW ? Math.round((used.weight / capW) * 100) : null,
        volumePct: capV ? Math.round((used.volume / capV) * 100) : null,
      };

      return {
        voyageCode: v?.voyageCode || "N/A",
        vesselName: v?.vesselName || "Unknown",
        lane: `${v?.origin || "Unknown"}→${v?.destination || "Unknown"}`,
        departAt: v?.departAt || null,
        arriveBy: v?.arriveBy || null,
        shipmentCount: v?._count?.assignments || 0,
        weightCapT: v?.weightCapT ?? null,
        volumeCapM3: v?.volumeCapM3 ?? null,
        usedWeightT: used.weight,
        usedVolumeM3: used.volume,
        remainingWeightT: remaining.weightT,
        remainingVolumeM3: remaining.volumeM3,
        utilization, // { weightPct, volumePct }
      };
    });

    // Upcoming voyages (departAt in future)
    const upcomingVoyages = voyages
      .filter((v) => {
        const dep = safeDate(v?.departAt);
        return dep && dep > now;
      })
      .slice(0, 10)
      .map((v) => {
        const used = usageMap.get(v.id) || { weight: 0, volume: 0 };
        const capW = Number(v?.weightCapT ?? 0);
        const capV = Number(v?.volumeCapM3 ?? 0);

        const remaining = {
          weightT: capW ? capW - used.weight : null,
          volumeM3: capV ? capV - used.volume : null,
        };

        const utilization = {
          weightPct: capW ? Math.round((used.weight / capW) * 100) : null,
          volumePct: capV ? Math.round((used.volume / capV) * 100) : null,
        };

        return {
          voyageCode: v?.voyageCode || "N/A",
          vesselName: v?.vesselName || "Unknown",
          lane: `${v?.origin || "Unknown"}→${v?.destination || "Unknown"}`,
          departAt: v?.departAt || null,
          arriveBy: v?.arriveBy || null,
          shipmentCount: v?._count?.assignments || 0,
          weightCapT: v?.weightCapT ?? null,
          volumeCapM3: v?.volumeCapM3 ?? null,
          usedWeightT: used.weight,
          usedVolumeM3: used.volume,
          remainingWeightT: remaining.weightT,
          remainingVolumeM3: remaining.volumeM3,
          utilization,
        };
      });

    // Final compact snapshot
    const snapshot = {
      version: `v${nowMs}`,
      generatedAt: toISODate(nowMs),
      shipments: {
        total: shipments.length,
        byStatus: statusCounts,
        priorityCount,
        topLanes: topShipmentLanes,
        recent: recentShipments,
      },
      voyages: {
        total: voyages.length,
        active: activeVoyagesCount,
        topLanes: topVoyageLanes,
        recent: recentVoyages,
        upcoming: upcomingVoyages,
      },
    };

    // Cache & return
    cachedSnapshot = snapshot;
    cacheAt = nowMs;
    return snapshot;

  } catch (error) {
    // Safe fallback so your UI never breaks
    const fallback = {
      version: "error",
      generatedAt: toISODate(Date.now()),
      shipments: {
        total: 0,
        byStatus: {},
        priorityCount: 0,
        topLanes: [],
        recent: [],
      },
      voyages: {
        total: 0,
        active: 0,
        topLanes: [],
        recent: [],
        upcoming: [],
      },
      error: error?.message || "snapshot_failed",
    };
    cachedSnapshot = fallback;
    cacheAt = Date.now();
    return fallback;
  }
}

/** Manual invalidation hook (call this after writes/migrations if needed) */
export function invalidateSnapshotCache() {
  cachedSnapshot = null;
  cacheAt = 0;
}
