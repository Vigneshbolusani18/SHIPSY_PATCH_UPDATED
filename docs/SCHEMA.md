
---

## 5) `docs/SCHEMA.md`
```markdown
# Database Schema (Conceptual)

> ORM: Prisma → Neon Postgres

## Shipments
- `id` (pk)
- `shipmentId` (string, unique)
- `origin` (string)
- `destination` (string)
- `shipDate` (date)
- `transitDays` (int)
- `status` (enum: CREATED | IN_TRANSIT | DELIVERED | RETURNED)
- `isPriority` (bool)
- `weightTons` (decimal)
- `volumeM3` (decimal)
- `createdAt`, `updatedAt`

## ShipmentEvents
- `id` (pk)
- `shipmentId` (fk → Shipments)
- `eventType` (string/enum; e.g., PICKUP_COMPLETED, ARRIVED_AT_PORT)
- `location` (string)
- `notes` (text)
- `occurredAt` (timestamp)
- `createdAt`

## Voyages
- `id` (pk)
- `voyageCode` (string, unique)
- `vesselName` (string)
- `origin` (string)
- `destination` (string)
- `departAt` (date)
- `arriveBy` (date)
- `weightCapT` (decimal)
- `volumeCapM3` (decimal)
- `createdAt`, `updatedAt`

## VoyageAssignments
- `id` (pk)
- `voyageId` (fk → Voyages)
- `shipmentId` (fk → Shipments)
- `assignedAt` (timestamp)

> Utilization = sum(assigned.weightTons)/weightCapT & sum(assigned.volumeM3)/volumeCapM3
