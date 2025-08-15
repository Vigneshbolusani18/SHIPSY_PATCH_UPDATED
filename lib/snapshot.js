// lib/snapshot.js (or wherever your snapshot function is)
import { prisma } from "@/lib/db";

let cachedSnapshot = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getSnapshotCached() {
  const now = Date.now();
  if (cachedSnapshot && (now - cacheTime) < CACHE_TTL) {
    return cachedSnapshot;
  }

  try {
    // Get shipment data
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
      take: 1000, // Reasonable limit for processing
    });

    // Get voyage data
    const voyages = await prisma.voyage.findMany({
      select: {
        voyageCode: true,
        vesselName: true,
        origin: true,
        destination: true,
        departAt: true,
        arriveBy: true,
        _count: {
          select: { assignments: true }
        }
      },
      orderBy: { departAt: "desc" },
      take: 100, // Recent voyages
    });

    // Process shipment statistics
    const statusCounts = {};
    const laneCounts = {};
    let priorityCount = 0;

    shipments.forEach(s => {
      // Status counts
      statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
      
      // Priority count
      if (s.isPriority) priorityCount++;
      
      // Lane counts
      const lane = `${s.origin}→${s.destination}`;
      laneCounts[lane] = (laneCounts[lane] || 0) + 1;
    });

    // Top lanes (sorted by frequency)
    const topLanes = Object.entries(laneCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([lane, count]) => ({ lane, count }));

    // Process voyage statistics
    const now = new Date();
    const activeVoyages = voyages.filter(v => 
      new Date(v.departAt) <= now && new Date(v.arriveBy) >= now
    );

    const recentVoyages = voyages.slice(0, 15).map(v => ({
      voyageCode: v.voyageCode,
      vesselName: v.vesselName,
      lane: `${v.origin}→${v.destination}`,
      departAt: v.departAt,
      arriveBy: v.arriveBy,
      shipmentCount: v._count.assignments,
    }));

    // Voyage lanes
    const voyageLaneCounts = {};
    voyages.forEach(v => {
      const lane = `${v.origin}→${v.destination}`;
      voyageLaneCounts[lane] = (voyageLaneCounts[lane] || 0) + 1;
    });

    const topVoyageLanes = Object.entries(voyageLaneCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([lane, count]) => ({ lane, count }));

    cachedSnapshot = {
      version: `v${now.getTime()}`,
      generatedAt: now.toISOString(),
      shipments: {
        total: shipments.length,
        byStatus: statusCounts,
        priorityCount,
        topLanes,
        recent: shipments.slice(0, 15).map(s => ({
          shipmentId: s.shipmentId,
          lane: `${s.origin}→${s.destination}`,
          status: s.status,
          isPriority: s.isPriority,
          shipDate: s.shipDate,
          transitDays: s.transitDays,
          weightTons: s.weightTons,
          volumeM3: s.volumeM3,
        })),
      },
      voyages: {
        total: voyages.length,
        active: activeVoyages.length,
        topLanes: topVoyageLanes,
        recent: recentVoyages,
        upcoming: voyages
          .filter(v => new Date(v.departAt) > now)
          .slice(0, 10)
          .map(v => ({
            voyageCode: v.voyageCode,
            vesselName: v.vesselName,
            lane: `${v.origin}→${v.destination}`,
            departAt: v.departAt,
            shipmentCount: v._count.assignments,
          })),
      },
    };

    cacheTime = now;
    return cachedSnapshot;

  } catch (error) {
    console.error("Error generating snapshot:", error);
    // Return basic fallback
    return {
      version: "error",
      generatedAt: new Date().toISOString(),
      shipments: { total: 0, byStatus: {}, priorityCount: 0, topLanes: [], recent: [] },
      voyages: { total: 0, active: 0, topLanes: [], recent: [], upcoming: [] },
      error: error.message,
    };
  }
}

// Optional: Function to manually refresh cache
export function invalidateSnapshotCache() {
  cachedSnapshot = null;
  cacheTime = 0;
}