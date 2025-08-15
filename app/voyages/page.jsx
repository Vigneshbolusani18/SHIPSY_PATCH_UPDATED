'use client'
import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import AIConsole from '@/components/ai/Console' // ✅ added

export default function VoyagesPage() {
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)

  const [openId, setOpenId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: 1, limit: 50, ...(q ? { q } : {}) })
      const res = await fetch(`/api/voyages?${params}`)
      const data = await res.json()
      setItems(data.items || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // initial

  async function viewPlan(voyageId) {
    setDetailLoading(true)
    try {
      if (openId === voyageId) {
        // collapse
        setOpenId(null)
        setDetail(null)
        return
      }
      setOpenId(voyageId)
      const res = await fetch(`/api/voyages/${voyageId}`)
      const data = await res.json()
      setDetail(data)
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="grid gap-6">
      <Card title="Voyages">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Input placeholder="Search voyages…" value={q} onChange={e=>setQ(e.target.value)} />
          <Button variant="ghost" onClick={load}>Search</Button>

          {/* existing auto-assign button (unchanged) */}
          <Button variant="ghost" onClick={async () => {
            const res = await fetch('/api/voyages/auto-assign', { method: 'POST' })
            const data = await res.json()
            alert(`Auto-assigned ${data.assignedCount} / ${data.processed}`)
            // refresh list so assignedCount updates
            load()
            // refresh details if open
            if (openId) viewPlan(openId)
          }}>
            Auto-assign Shipments
          </Button>

          {/* NEW: AI Auto-Assign button — added without touching existing logic */}
          <Button
            variant="ghost"
            onClick={async () => {
              const res = await fetch('/api/voyages/ai-assign', { method: 'POST' })
              // Defensive parse in case the API returns an empty body
              let data = { assigned: 0, processed: 0 }
              try {
                const text = await res.text()
                if (text) data = JSON.parse(text)
              } catch (_) {}
              alert(`AI assigned ${data.assigned} / ${data.processed}`)
              await load()
              if (openId) await viewPlan(openId)
            }}
          >
            AI Auto-Assign (AI)
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[rgb(var(--muted))]">
              <tr>
                <th className="py-2">Voyage</th>
                <th className="py-2">Vessel</th>
                <th className="py-2">Lane</th>
                <th className="py-2">Depart</th>
                <th className="py-2">Arrive</th>
                <th className="py-2">Assigned</th>
                <th className="py-2">Plan</th>
              </tr>
            </thead>
            <tbody>
              {items.map(v => (
                <tr key={v.id} className="border-t border-white/10">
                  <td className="py-2">{v.voyageCode}</td>
                  <td className="py-2">{v.vesselName}</td>
                  <td className="py-2">{v.origin} → {v.destination}</td>
                  <td className="py-2">{new Date(v.departAt).toLocaleDateString()}</td>
                  <td className="py-2">{new Date(v.arriveBy).toLocaleDateString()}</td>
                  <td className="py-2">{v.assignedCount}</td>
                  <td className="py-2">
                    <button className="btn btn-ghost" onClick={() => viewPlan(v.id)}>
                      {openId === v.id ? 'Hide' : 'View Plan'}
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-[rgb(var(--muted))]">
                  {loading ? 'Loading…' : 'No voyages'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Expanded details */}
        {openId && detail && (
          <div className="mt-6 card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm text-[rgb(var(--muted))]">Voyage</div>
                <div className="font-medium">{detail.voyage.voyageCode} — {detail.voyage.vesselName}</div>
                <div className="text-xs text-[rgb(var(--muted))]">
                  {detail.voyage.origin} → {detail.voyage.destination} ·
                  {' '}Dep {new Date(detail.voyage.departAt).toLocaleDateString()} ·
                  {' '}Arr {new Date(detail.voyage.arriveBy).toLocaleDateString()}
                </div>
              </div>
              {/* Utilization bars */}
              <div className="min-w-[260px]">
                <div className="text-xs text-[rgb(var(--muted))] mb-1">
                  Weight Utilization {detail.utilization.weight}%
                  {detail.utilization.capWeightT ? ` (${detail.utilization.usedWeightT}/${detail.utilization.capWeightT} t)` : ` (${detail.utilization.usedWeightT} t)` }
                </div>
                <div className="h-2 w-full rounded bg-white/10 overflow-hidden">
                  <div
                    className="h-2 bg-white/70"
                    style={{ width: `${Math.min(100, detail.utilization.weight)}%` }}
                  />
                </div>

                <div className="text-xs text-[rgb(var(--muted))] mt-3 mb-1">
                  Volume Utilization {detail.utilization.volume}%
                  {detail.utilization.capVolumeM3 ? ` (${detail.utilization.usedVolumeM3}/${detail.utilization.capVolumeM3} m³)` : ` (${detail.utilization.usedVolumeM3} m³)` }
                </div>
                <div className="h-2 w-full rounded bg-white/10 overflow-hidden">
                  <div
                    className="h-2 bg-white/70"
                    style={{ width: `${Math.min(100, detail.utilization.volume)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Assigned shipments table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[rgb(var(--muted))]">
                  <tr>
                    <th className="py-2">Shipment</th>
                    <th className="py-2">Lane</th>
                    <th className="py-2">Ship Date</th>
                    <th className="py-2">Transit</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Priority</th>
                    <th className="py-2">Wt/Vol</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.shipments.length === 0 ? (
                    <tr><td colSpan={7} className="py-6 text-center text-[rgb(var(--muted))]">No shipments assigned</td></tr>
                  ) : detail.shipments.map(s => (
                    <tr key={s.id} className="border-t border-white/10">
                      <td className="py-2">{s.shipmentId}</td>
                      <td className="py-2">{s.origin} → {s.destination}</td>
                      <td className="py-2">{new Date(s.shipDate).toLocaleDateString()}</td>
                      <td className="py-2">{s.transitDays}d</td>
                      <td className="py-2">{s.status}</td>
                      <td className="py-2">{s.isPriority ? 'Yes' : 'No'}</td>
                      <td className="py-2">{s.weightTons ?? '-'}t / {s.volumeM3 ?? '-'}m³</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {detailLoading && <div className="mt-2 text-xs text-[rgb(var(--muted))]">Refreshing…</div>}
          </div>
        )}
      </Card>

      {/* ✅ AI console added at the bottom, grounded with DB by default */}
      <AIConsole title="AI Console — Voyages" defaultUseDb={true} />
    </div>
  )
}