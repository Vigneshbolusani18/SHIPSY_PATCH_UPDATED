
---

## 11) `docs/AI/SNAPSHOT_CACHING.md`
```markdown
# Snapshot Caching

## Goal
Reduce token usage and speed up analytics while staying fresh.

## Approach
- Build a snapshot object:
```json
{
  "version": "v1692123456789",
  "shipments": {
    "total": 150,
    "byStatus": { "CREATED": 45, "IN_TRANSIT": 80, "DELIVERED": 25 },
    "priorityCount": 32,
    "topLanes": [{ "lane": "Mumbai→Delhi", "count": 25 }]
  },
  "voyages": { "total": 12, "active": 5, "upcoming": 3 }
}
