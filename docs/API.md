
---

## 2) `docs/API.md`
```markdown
# API Reference

**Base URL:** `/api`  
**Auth:** JWT via httpOnly cookie. Endpoints marked 🔒 require login.  
**Format:** JSON; ISO-8601 dates; pagination returns `{ items: [], total }`.

---

## Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /me` 🔒

---

## Shipments
- `GET /shipments` — list (filters: `page`, `limit`, `sortBy`, `order`, `q`, `status`, `isPriority`)
- `POST /shipments` — create
- `GET /shipments/:id` — detail
- `PUT /shipments/:id` — update
- `DELETE /shipments/:id` — delete

### Tracking Events
- `GET /shipments/:id/events`
- `POST /shipments/:id/events`

### Movement
- `POST /shipments/move` — `{ "shipmentId": "...", "voyageId": "..." }`

---

## Voyages
- `GET /voyages` — `q` searches code/vessel/origin/destination
- `POST /voyages` — create
- `GET /voyages/:id` — detail + assigned shipments + utilization

### Per-voyage Ops
- `POST /voyages/:id/assign` — `{ "shipmentId": "..." }`
- `POST /voyages/:id/plan` — generate load plan (FFD-style)

### Bulk
- `POST /voyages/auto-assign` — rule-based
- `POST /voyages/ai-assign` — Gemini-assisted

---

## Planning
- `POST /plan/ffd` — First-Fit Decreasing packer

---

## AI
- `POST /ai/answer` — Natural language Q&A
- `POST /ai/chat` — Simple chat helper
- `POST /ai/plan-hint` — AI suggestions for assignments
- `POST /ai/predict-delay` — ETA/delay reasoning
- `GET /ai/test` — health
- `POST /ai/test` — echo test

---

## Stats
- `GET /stats/overview` — cached snapshot

---

## Status Codes
- `200` OK · `201` Created · `400` Bad Request · `401` Unauthorized · `404` Not Found · `500` Server Error
