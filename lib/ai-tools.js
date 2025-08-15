// lib/ai-tools.js

import { prisma } from "@/lib/db";
import { getSnapshotCached } from "@/lib/snapshot";

/**
 * Finds specific shipments based on criteria like city and status.
 * Returns shipment details including the associated voyageCode and vesselName.
 * This tool gives the AI specific, real-time data.
 */
export async function findShipments({ city, status }) {
  console.log(`TOOL: finding shipments for city=${city}, status=${status}`);
  const statusEnum = normalizeStatus(status);

  const where = {
    OR: [
      { origin: { contains: city, mode: "insensitive" } },
      { destination: { contains: city, mode: "insensitive" } },
    ],
    ...(statusEnum ? { status: statusEnum } : {}),
  };

  const results = await prisma.shipment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      shipmentId: true,
      origin: true,
      destination: true,
      status: true,
      isPriority: true,
      shipDate: true,
      assignments: {
        orderBy: { createdAt: 'desc' },
        take: 1, // Get the latest voyage assignment for this shipment
        select: {
          voyage: {
            select: {
              voyageCode: true,
              vesselName: true,
            }
          }
        }
      }
    },
  });

  // Transform the nested data into a simple, flat format for the AI
  const flattenedResults = results.map(s => {
    const latestAssignment = s.assignments[0];
    return {
      shipmentId: s.shipmentId,
      origin: s.origin,
      destination: s.destination,
      status: s.status,
      isPriority: s.isPriority,
      shipDate: s.shipDate,
      voyageCode: latestAssignment?.voyage?.voyageCode || 'N/A',
      vesselName: latestAssignment?.voyage?.vesselName || 'N/A',
    };
  });

  return flattenedResults;
}

/**
 * Gets detailed information for a single voyage by its code.
 * This tool gives the AI deep-dive capability on a specific voyage.
 */
export async function getVoyageDetails({ voyageCode }) {
  console.log(`TOOL: getting details for voyage=${voyageCode}`);
  const voyage = await prisma.voyage.findFirst({
    where: { voyageCode: { equals: voyageCode, mode: "insensitive" } },
    include: {
      _count: { select: { assignments: true } },
      assignments: {
        take: 10,
        select: { shipment: { select: { shipmentId: true, status: true } } },
      },
    },
  });
  return voyage;
}

/**
 * Gets a high-level summary of all logistics operations from the cache.
 * This tool is for general questions about totals and counts.
 */
export async function getGeneralSummary() {
  console.log("TOOL: getting general summary snapshot");
  // The snapshot cache is perfect for this kind of summary
  return await getSnapshotCached();
}

/**
 * Helper function to convert natural language status to the database enum.
 */
function normalizeStatus(s) {
  if (!s) return null;
  const t = String(s).toLowerCase().replace(/[-\s]+/g, "_");
  if (/(^|_)in_?transit$/.test(t) || t === "transit") return "IN_TRANSIT";
  if (t === "delivered") return "DELIVERED";
  if (t === "created" || t === "pending") return "CREATED";
  if (t === "returned") return "RETURNED";
  return null;
}