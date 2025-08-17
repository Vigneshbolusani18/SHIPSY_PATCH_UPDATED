// lib/canonicalize.js

function toISODate(d) {
  try {
    const date = d instanceof Date ? d : new Date(d);
    return date.toISOString().slice(0, 10);
  } catch {
    return String(d || "");
  }
}

export function canonShipment(s) {
  const parts = [
    `Shipment ${s.shipmentId}`,
    `Status: ${s.status}`,
    `Origin: ${s.origin} → Destination: ${s.destination}`,
    `Ship Date: ${toISODate(s.shipDate)}`,
    `Transit Days: ${s.transitDays}`,
    s.weightTons != null ? `Weight: ${s.weightTons} tons` : "",
    s.volumeM3 != null ? `Volume: ${s.volumeM3} m³` : "",
  ].filter(Boolean);
  return parts.join("\n");
}

export function canonVoyage(v) {
  const parts = [
    `Voyage ${v.voyageCode}`,
    `Vessel: ${v.vesselName}`,
    `Route: ${v.origin} → ${v.destination}`,
    `Depart: ${toISODate(v.departAt)}`,
    `ArriveBy: ${toISODate(v.arriveBy)}`,
    v.weightCapT != null ? `Capacity (weight): ${v.weightCapT} tons` : "",
    v.volumeCapM3 != null ? `Capacity (volume): ${v.volumeCapM3} m³` : "",
  ].filter(Boolean);
  return parts.join("\n");
}

export function canonEvent(e) {
  const parts = [
    `Event ${e.eventType}`,
    `ShipmentId: ${e.shipmentId}`,
    `Location: ${e.location}`,
    e.notes ? `Notes: ${e.notes}` : "",
    `OccurredAt: ${new Date(e.occurredAt).toISOString()}`,
  ].filter(Boolean);
  return parts.join("\n");
}
