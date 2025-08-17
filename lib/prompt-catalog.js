// lib/prompt-catalog.js
export const SCHEMA_SUMMARY = `
TABLES & FIELDS (Prisma model → columns)
- User(id, username, passwordHash, createdAt) — not queryable by AI.
- Shipment(id, shipmentId*, status{CREATED|IN_TRANSIT|DELIVERED|RETURNED}, isPriority, origin, destination, shipDate, transitDays, weightTons?, volumeM3?, createdAt, updatedAt)
- TrackingEvent(id, shipmentId(FK Shipment.id), eventType{CREATED|SCANNED|LOADED|DEPARTED|ARRIVED|DELIVERED|DELAYED}, location, notes?, occurredAt, createdAt)
- Voyage(id, voyageCode*, vesselName, origin, destination, departAt, arriveBy, weightCapT?, volumeCapM3?, createdAt, updatedAt)
- VoyageAssignment(id, voyageId(FK Voyage.id), shipmentId(FK Shipment.id), createdAt)
RELATIONSHIPS
- Shipment 1—* TrackingEvent (by Shipment.id)
- Voyage 1—* VoyageAssignment *—1 Shipment
INDEX HINTS
- Shipments indexed by (status,isPriority,createdAt), (shipDate), (shipmentId)
- VoyageAssignment unique (voyageId, shipmentId)
`;

export const GLOSSARY = `
TERMS
- "lane": origin→destination.
- "utilization": assigned weight/volume vs voyage capacity.
- "delayed": ETA (shipDate + transitDays) in the past and status != DELIVERED, or has a DELAYED event.
- Units: "t","ton","tons","tonne","tonnes" → weightTons; "kg" converts to tons ( / 1000 ). Volume in "m3","cubic meters".
- Date ranges: "last N days", "next N days", "between YYYY-MM-DD and YYYY-MM-DD", "in <month/year>", "today".
`;

export const INTENT_SCHEMA = `
You must output ONLY JSON matching this structure:

{
  "entity": "shipment" | "voyage" | "tracking" | "kpi" | "plan",
  "operation": "count" | "list" | "group" | "utilization" | "track" | "details" | "suggest_assignment" | "capacity_remaining" | "delayed" | "top_lanes" | "active_now",
  "ids": { "shipmentId"?: string, "voyageCode"?: string },
  "filters": [
    { "field": string, "op": "eq"|"neq"|"gt"|"gte"|"lt"|"lte"|"contains"|"in"|"between"|"range", "value": any }
  ],
  "groupBy": string[],
  "metrics": [{ "fn": "count"|"sum"|"avg"|"min"|"max", "field"?: string, "as"?: string }],
  "orderBy": [{ "field": string, "dir": "asc"|"desc" }],
  "limit": number
}

FIELD NAMES must come from the schema summary. Allowed filter fields:
- shipment.*: status, isPriority, origin, destination, shipDate, transitDays, weightTons, volumeM3, shipmentId, createdAt, updatedAt
- voyage.*: voyageCode, vesselName, origin, destination, departAt, arriveBy, weightCapT, volumeCapM3, createdAt, updatedAt
- tracking.*: eventType, location, occurredAt, createdAt
When asking for "which voyage fits"/"can we assign", use operation "suggest_assignment".
`;

export const EXAMPLES_25 = [
  { user: "How many shipments are in transit to Mumbai?",
    plan: { entity:"shipment", operation:"count",
      filters:[{field:"status",op:"eq",value:"IN_TRANSIT"},{field:"destination",op:"contains",value:"Mumbai"}]}},
  { user: "List shipments to Mumbai heavier than 2 tons",
    plan: { entity:"shipment", operation:"list", limit:20,
      filters:[{field:"destination",op:"contains",value:"Mumbai"},{field:"weightTons",op:"gte",value:2}],
      orderBy:[{field:"shipDate",dir:"desc"}]}},
  { user: "Where is SHP-104?",
    plan: { entity:"tracking", operation:"track", ids:{ shipmentId:"SHP-104" }, limit:20 }},
  { user: "Show utilization for voyage VYG-001",
    plan: { entity:"voyage", operation:"utilization", ids:{ voyageCode:"VYG-001" } }},
  { user: "Which shipments are delayed?",
    plan: { entity:"shipment", operation:"delayed", limit:50 }},
  { user: "Which voyage is SHP-104 on?",
    plan: { entity:"plan", operation:"details", ids:{ shipmentId:"SHP-104" } }},
  { user: "Voyages departing between 2025-08-01 and 2025-08-15",
    plan: { entity:"voyage", operation:"list",
      filters:[{field:"departAt",op:"between",value:["2025-08-01","2025-08-15"]}],
      orderBy:[{field:"departAt",dir:"asc"}], limit:50 }},
  { user: "Which voyages are currently active?",
    plan: { entity:"voyage", operation:"active_now", limit:50 }},
  { user: "Top shipment lanes this month",
    plan: { entity:"kpi", operation:"top_lanes",
      filters:[{field:"shipDate",op:"range",value:"this_month"}], limit:10 }},
  { user: "Priority shipments from Goa to Mumbai count",
    plan: { entity:"shipment", operation:"count",
      filters:[{field:"isPriority",op:"eq",value:true},{field:"origin",op:"contains",value:"Goa"},{field:"destination",op:"contains",value:"Mumbai"}]}},
  { user: "Shipments grouped by status last 7 days",
    plan: { entity:"shipment", operation:"group", groupBy:["status"],
      filters:[{field:"shipDate",op:"range",value:"last_7d"}],
      metrics:[{fn:"count",as:"count"}]}},
  { user: "Capacity remaining on VYG-001",
    plan: { entity:"voyage", operation:"capacity_remaining", ids:{ voyageCode:"VYG-001" } }},
  { user: "Can we fit SHP-104 on any upcoming voyage to Mumbai?",
    plan: { entity:"plan", operation:"suggest_assignment", ids:{ shipmentId:"SHP-104" },
      filters:[{field:"destination",op:"contains",value:"Mumbai"},{field:"departAt",op:"range",value:"next_30d"}], limit:10 }},
  { user: "List shipments without a voyage",
    plan: { entity:"shipment", operation:"list",
      filters:[{field:"assignments",op:"eq",value:"none"}], limit:50 }},
  { user: "Next ship date for shipments to Chennai",
    plan: { entity:"shipment", operation:"list",
      filters:[{field:"destination",op:"contains",value:"Chennai"}],
      orderBy:[{field:"shipDate",dir:"asc"}], limit:1 }},
  { user: "Shipments over 5 tons to Mumbai this month",
    plan: { entity:"shipment", operation:"list",
      filters:[{field:"destination",op:"contains",value:"Mumbai"},{field:"weightTons",op:"gt",value:5},{field:"shipDate",op:"range",value:"this_month"}],
      orderBy:[{field:"shipDate",dir:"desc"}], limit:20 }},
  { user: "Show last 10 events for SHP-200",
    plan: { entity:"tracking", operation:"list",
      ids:{ shipmentId:"SHP-200" }, orderBy:[{field:"occurredAt",dir:"desc"}], limit:10 }},
  { user: "Voyages arriving by 2025-08-31 to Mumbai",
    plan: { entity:"voyage", operation:"list",
      filters:[{field:"arriveBy",op:"lte",value:"2025-08-31"},{field:"destination",op:"contains",value:"Mumbai"}],
      orderBy:[{field:"arriveBy",dir:"asc"}]}},
  { user: "How many shipments were created in the last 14 days?",
    plan: { entity:"shipment", operation:"count",
      filters:[{field:"createdAt",op:"range",value:"last_14d"}]}},
  { user: "List voyages Goa→Mumbai next 60 days",
    plan: { entity:"voyage", operation:"list", limit:50,
      filters:[{field:"origin",op:"contains",value:"Goa"},{field:"destination",op:"contains",value:"Mumbai"},{field:"departAt",op:"range",value:"next_60d"}],
      orderBy:[{field:"departAt",dir:"asc"}]}},
  { user: "Give me KPIs by shipment status",
    plan: { entity:"kpi", operation:"group", groupBy:["status"], metrics:[{fn:"count",as:"count"}]}},
  { user: "Which lanes have most delays this quarter?",
    plan: { entity:"kpi", operation:"top_lanes",
      filters:[{field:"shipDate",op:"range",value:"this_quarter"},{field:"delayed",op:"eq",value:true}], limit:10 }},
  { user: "Total weight and volume by destination last month",
    plan: { entity:"shipment", operation:"group", groupBy:["destination"],
      filters:[{field:"shipDate",op:"range",value:"last_month"}],
      metrics:[{fn:"sum",field:"weightTons",as:"totalWeightT"},{fn:"sum",field:"volumeM3",as:"totalVolumeM3"}],
      orderBy:[{field:"totalWeightT",dir:"desc"}]}},
  { user: "Show voyages with less than 20% capacity left",
    plan: { entity:"voyage", operation:"list",
      filters:[{field:"utilization",op:"gte",value:80}], limit:50 }},
  { user: "Status of shp-104",
    plan: { entity:"tracking", operation:"track", ids:{ shipmentId:"SHP-104" }, limit:20 }}
];

export function buildIntentPrompt(question) {
  return `
You are "Smart Freight Intent Parser". Output ONLY JSON matching INTENT schema. No prose, no markdown, no backticks.

SCHEMA:
${SCHEMA_SUMMARY}

GLOSSARY:
${GLOSSARY}

INTENT SCHEMA:
${INTENT_SCHEMA}

EXAMPLES:
${JSON.stringify(EXAMPLES_25, null, 2)}

USER QUESTION:
${String(question)}
`.trim();
}
