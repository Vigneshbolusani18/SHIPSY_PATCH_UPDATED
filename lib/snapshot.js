// lib/snapshot.js
import { prisma } from "@/lib/db";

// Simple in-memory cache (per server instance)
let cachedSnapshot = null;
let cacheAt = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getSnapshotCached() {
  const nowMs = Date.now();
  if (cachedSnapshot && (nowMs - cacheAt) < CACHE_TTL) {
    return cachedSnapshot;
  }

  try {
    // ---- Summarize shipments (with error handling) ----
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
      take: 1000, // Upper bound to keep snapshot small & fast
    }).catch(error => {
      console.error("Error fetching shipments:", error);
      return [];
    });

    // ---- Summarize voyages (with error handling) ----
    const voyages = await prisma.voyage.findMany({
      select: {
        voyageCode: true,
        vesselName: true,
        origin: true,
        destination: true,
        departAt: true,
        arriveBy: true,
        _count: { select: { assignments: true } },
      },
      orderBy: { departAt: "desc" },
      take: 100, // Cap for small snapshot
    }).catch(error => {
      console.error("Error fetching voyages:", error);
      return [];
    });

    // ---- Compute shipment metrics ----
    const statusCounts = {};
    const laneCounts = {};
    let priorityCount = 0;

    for (const s of shipments) {
      // Safe status handling
      const status = s.status || 'UNKNOWN';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      
      if (s.isPriority) priorityCount++;
      
      // Safe lane construction
      const origin = s.origin || 'Unknown';
      const destination = s.destination || 'Unknown';
      const lane = `${origin}→${destination}`;
      laneCounts[lane] = (laneCounts[lane] || 0) + 1;
    }

    const topLanes = Object.entries(laneCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([lane, count]) => ({ lane, count }));

    const recentShipments = shipments.slice(0, 15).map(s => ({
      shipmentId: s.shipmentId || 'N/A',
      lane: `${s.origin || 'Unknown'}→${s.destination || 'Unknown'}`,
      status: s.status || 'UNKNOWN',
      isPriority: Boolean(s.isPriority),
      shipDate: s.shipDate,
      transitDays: s.transitDays || 0,
      weightTons: s.weightTons,
      volumeM3: s.volumeM3,
    }));

    // ---- Compute voyage metrics ----
    const now = new Date();
    const activeVoyages = voyages.filter(v => {
      try {
        return new Date(v.departAt) <= now && new Date(v.arriveBy) >= now;
      } catch {
        return false;
      }
    });

    const recentVoyages = voyages.slice(0, 15).map(v => ({
      voyageCode: v.voyageCode || 'N/A',
      vesselName: v.vesselName || 'Unknown',
      lane: `${v.origin || 'Unknown'}→${v.destination || 'Unknown'}`,
      departAt: v.departAt,
      arriveBy: v.arriveBy,
      shipmentCount: v._count?.assignments || 0,
    }));

    const voyageLaneCounts = {};
    for (const v of voyages) {
      const origin = v.origin || 'Unknown';
      const destination = v.destination || 'Unknown';
      const lane = `${origin}→${destination}`;
      voyageLaneCounts[lane] = (voyageLaneCounts[lane] || 0) + 1;
    }

    const topVoyageLanes = Object.entries(voyageLaneCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([lane, count]) => ({ lane, count }));

    const upcomingVoyages = voyages
      .filter(v => {
        try {
          return new Date(v.departAt) > now;
        } catch {
          return false;
        }
      })
      .slice(0, 10)
      .map(v => ({
        voyageCode: v.voyageCode || 'N/A',
        vesselName: v.vesselName || 'Unknown',
        lane: `${v.origin || 'Unknown'}→${v.destination || 'Unknown'}`,
        departAt: v.departAt,
        shipmentCount: v._count?.assignments || 0,
      }));

    const snapshot = {
      version: `v${nowMs}`, // Simple version that changes ~every refresh
      generatedAt: new Date(nowMs).toISOString(),
      shipments: {
        total: shipments.length,
        byStatus: statusCounts,
        priorityCount,
        topLanes,
        recent: recentShipments,
      },
      voyages: {
        total: voyages.length,
        active: activeVoyages.length,
        topLanes: topVoyageLanes,
        recent: recentVoyages,
        upcoming: upcomingVoyages,
      },
    };

    cachedSnapshot = snapshot;
    cacheAt = nowMs;
    console.log(`Snapshot generated: ${shipments.length} shipments, ${voyages.length} voyages`);
    return snapshot;
    
  } catch (error) {
    console.error("Critical error generating snapshot:", error);
    
    // Return safe fallback snapshot
    const fallback = {
      version: "error",
      generatedAt: new Date().toISOString(),
      shipments: { 
        total: 0, 
        byStatus: {}, 
        priorityCount: 0, 
        topLanes: [], 
        recent: [] 
      },
      voyages: { 
        total: 0, 
        active: 0, 
        topLanes: [], 
        recent: [], 
        upcoming: [] 
      },
      error: error.message,
    };
    
    // Cache the error state briefly to avoid repeated failures
    cachedSnapshot = fallback;
    cacheAt = Date.now();
    return fallback;
  }
}

export function invalidateSnapshotCache() {
  cachedSnapshot = null;
  cacheAt = 0;
  console.log("Snapshot cache invalidated");
}