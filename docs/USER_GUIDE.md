# Smart Freight & Storage Planner — User Guide

Welcome to the Smart Freight & Storage Planner. This guide shows you how to use shipments, voyages, tracking, AI console, and analytics.

## Live App
- Web: https://shipsy-rhm5.vercel.app/

## Sign In / Auth
- Cookie-based auth (JWT). After login, the app sets an httpOnly cookie.

---

## Shipments
### Create
1. Go to **Shipments** → **New**.
2. Fill: `shipmentId`, `origin`, `destination`, `shipDate`, `transitDays`, `weightTons`, `volumeM3`, `priority`, `status`.
3. Submit to create.

### Manage
- **List**: paginate, filter, search by id/origin/destination/status/priority.
- **Edit**: update any field.
- **Delete**: remove shipment.
- **Track**: open a shipment → **Events** → add pickup/in-transit/delivery events.

---

## Voyages
### Create Voyage
- Fields: `voyageCode`, `vesselName`, `origin`, `destination`, `departAt`, `arriveBy`, `weightCapT`, `volumeCapM3`.

### Manage Capacity
- View utilization by **weight** and **volume**.
- Assign shipments via:
  - **Per-voyage Assign** (manual pick).
  - **Rule-based Auto-Assign** (bulk).
  - **AI-Assign** (Gemini-assisted).

---

## Real-time Tracking
- Add tracking events per shipment: location, event type, timestamp, notes.
- Timeline and audit trail visible in shipment detail.

---

## AI Console
- Ask: “shipments from Mumbai in transit”, “recommend assignments”, “predict delays”.
- Toggle **Use database** for grounded answers from Postgres.
- AI can explain decisions (capacity, route, dates).

---

## Analytics
- Overview cards: totals, status breakdown, priority counts.
- Top lanes (e.g., Mumbai→Delhi).
- Snapshot caching accelerates dashboards.

---

## Quick API Actions (Examples)
- Create shipment:
```json
POST /api/shipments
{
  "shipmentId": "SHP-001",
  "origin": "Mumbai",
  "destination": "Delhi",
  "shipDate": "2025-08-15",
  "transitDays": 3,
  "weightTons": 25.5,
  "volumeM3": 45.2
}
