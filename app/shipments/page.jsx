'use client'

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import AIConsole from '@/components/ai/Console'
import DynamicBackground from '@/components/DynamicBackground'


const STATUSES = ['CREATED','IN_TRANSIT','DELIVERED','RETURNED']
const EVENT_TYPES = ['CREATED','SCANNED','LOADED','DEPARTED','ARRIVED','DELIVERED','DELAYED']

// ---- Helpers
function parseAssignMessages(messages = []) {
  const pairs = []
  const r = /✅\s*([\w.-]+)[^\n]*?(?:assigned\s*to|→)\s*([\w.-]+)/i
  for (const m of messages) {
    const mm = String(m || '').match(r)
    if (mm) pairs.push({ shipmentId: mm[1], voyageCode: mm[2] })
  }
  return pairs
}
function coercePairsFromPayload(data = {}, messages = []) {
  const out = []
  const pushArr = (arr) => {
    if (Array.isArray(arr)) {
      for (const x of arr) {
        if (x && typeof x === 'object') {
          const sid = x.shipmentId ?? x.shipId ?? x.ship ?? x.ShipmentId
          const voy = x.voyageCode ?? x.voyCode ?? x.voy ?? x.VoyageCode
          if (sid && voy) out.push({ shipmentId: String(sid), voyageCode: String(voy) })
        }
      }
    }
  }
  pushArr(data.pairs)
  pushArr(data.assignedPairs)
  pushArr(data.assignments)
  pushArr(data.suggestions)
  if (!out.length) return parseAssignMessages(messages)
  return out
}
const fmtTime = (ts) => new Date(ts).toLocaleString()

export default function ShipmentsPage() {
  // ----- Tabs -----
  const [tab, setTab] = useState('add') // 'add' | 'manage' | 'ai' | 'warnings'

  // list/query state
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [isPriority, setIsPriority] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [order, setOrder] = useState('desc')

  // create form
  const [form, setForm] = useState({
    shipmentId: '', origin: '', destination: '',
    shipDate: '', transitDays: 7, status: 'CREATED', isPriority: false,
    weightTons: '', volumeM3: ''
  })

  // tracking events UI
  const [openShipmentId, setOpenShipmentId] = useState(null)
  const [events, setEvents] = useState([])
  const [evForm, setEvForm] = useState({ eventType: 'SCANNED', location: '', notes: '', occurredAt: '' })
  const [evLoading, setEvLoading] = useState(false)

  // AI UI
  const [vessel, setVessel] = useState({ weightCap: '', volumeCap: '' })
  const [aiHint, setAiHint] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [etaLoadingId, setEtaLoadingId] = useState(null)
  const [etaResultId, setEtaResultId] = useState(null)
  const [etaResult, setEtaResult] = useState('')

  // filters for AI tools
  const [aiFilter, setAiFilter] = useState({ origin:'', destination:'', startAfter:'' })

  // Voyages quick actions state
  const [showVoyageForm, setShowVoyageForm] = useState(false)
  const [voyageForm, setVoyageForm] = useState({
    voyageCode: '', vesselName: '', origin: '', destination: '',
    departAt: '', arriveBy: '', weightCapT: '', volumeCapM3: ''
  })

  // FFD result
  const [ffdOut, setFfdOut] = useState(null)

  // Reports for warnings tab
  const [reports, setReports] = useState([])
  // report: { id, time, source: 'assign'|'ai-assign'|'auto'|'ai', assigned, processed, pairs:[], messages:[] }

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit])

  async function load() {
    const params = new URLSearchParams({
      page, limit, sortBy, order,
      ...(q ? { q } : {}),
      ...(status ? { status } : {}),
      ...(isPriority !== '' ? { isPriority } : {}),
    })
    const res = await fetch(`/api/shipments?${params}`)
    const data = await res.json()
    setItems(data.items || [])
    setTotal(data.total || 0)
  }
  useEffect(() => { load() }, [page, limit, q, status, isPriority, sortBy, order])

  async function createShipment(e) {
    e.preventDefault()
    const res = await fetch('/api/shipments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setForm({ shipmentId:'', origin:'', destination:'', shipDate:'', transitDays:7, status:'CREATED', isPriority:false, weightTons:'', volumeM3:'' })
      setPage(1); load(); setTab('manage')
    } else {
      const err = await res.json().catch(()=>({})); alert(err.error || 'Create failed')
    }
  }

  function toggleSort(col) {
    if (sortBy === col) setOrder(order === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setOrder('asc') }
  }

  async function del(id) {
    if (!confirm('Delete this shipment?')) return
    const res = await fetch(`/api/shipments/${id}`, { method: 'DELETE' })
    if (res.ok) { if (openShipmentId === id) { setOpenShipmentId(null); setEvents([]) } load() }
    else alert('Delete failed')
  }

  // ---- Tracking Events ----
  async function openEvents(s) {
    setOpenShipmentId(s.id)
    setEvForm({ eventType:'SCANNED', location:s.destination || '', notes:'', occurredAt:'' })
    setEvLoading(true)
    try {
      const res = await fetch(`/api/shipments/${s.id}/events`)
      const data = await res.json()
      setEvents(data.items || [])
    } finally { setEvLoading(false) }
  }

  async function addEvent(e) {
    e.preventDefault()
    if (!openShipmentId) return
    setEvLoading(true)
    try {
      const res = await fetch(`/api/shipments/${openShipmentId}/events`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evForm),
      })
      if (res.ok) {
        setEvForm({ eventType:'SCANNED', location:'', notes:'', occurredAt:'' })
        const r2 = await fetch(`/api/shipments/${openShipmentId}/events`)
        const d2 = await r2.json()
        setEvents(d2.items || [])
      } else { alert('Failed to add event') }
    } finally { setEvLoading(false) }
  }

  // ---- Gemini helpers ----
  async function getPlanHint() {
    try {
      setAiLoading(true); setAiHint('Thinking…')
      const payload = {
        vessel: {
          weightCap: vessel.weightCap ? Number(vessel.weightCap) : undefined,
          volumeCap: vessel.volumeCap ? Number(vessel.volumeCap) : undefined,
        },
        shipments: items.map(s => ({
          id:s.id, shipmentId:s.shipmentId, status:s.status, isPriority:s.isPriority,
          origin:s.origin, destination:s.destination, shipDate:s.shipDate, transitDays:s.transitDays,
          weightTons:s.weightTons ?? null, volumeM3:s.volumeM3 ?? null,
        })),
        filters: { origin: aiFilter.origin || undefined, destination: aiFilter.destination || undefined, startAfter: aiFilter.startAfter || undefined }
      }
      const res = await fetch('/api/ai/plan-hint', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      setAiHint(data.hint || data.error || 'No hint')
    } catch { setAiHint('AI error') }
    finally { setAiLoading(false) }
  }

  async function predictETA(s) {
    try {
      setEtaLoadingId(s.id); setEtaResultId(s.id); setEtaResult('…')
      const res = await fetch('/api/ai/predict-delay', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ origin:s.origin, destination:s.destination, shipDate:s.shipDate, transitDays:s.transitDays })
      })
      const data = await res.json()
      setEtaResult(data.raw || data.error || 'No response')
    } catch { setEtaResult('AI error') }
    finally { setEtaLoadingId(null) }
  }

  async function runFFD() {
    setFfdOut({ loading:true })
    try {
      const payload = {
        vessel: {
          weightCap: vessel.weightCap ? Number(vessel.weightCap) : undefined,
          volumeCap: vessel.volumeCap ? Number(vessel.volumeCap) : undefined,
        },
        shipments: items,
        filters: { origin: aiFilter.origin || undefined, destination: aiFilter.destination || undefined, startAfter: aiFilter.startAfter || undefined }
      }
      const res = await fetch('/api/plan/ffd', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      setFfdOut(data)
    } catch { setFfdOut({ error:'Failed to plan' }) }
  }

  async function createVoyage(e) {
    e.preventDefault()
    try {
      const res = await fetch('/api/voyages', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(voyageForm) })
      if (!res.ok) {
        const err = await res.json().catch(()=>({})); alert(err.error || 'Failed to create voyage'); return
      }
      setVoyageForm({ voyageCode:'', vesselName:'', origin:'', destination:'', departAt:'', arriveBy:'', weightCapT:'', volumeCapM3:'' })
      setShowVoyageForm(false)
      alert('Voyage created!'); load()
    } catch { alert('Network error while creating voyage') }
  }

  // ===== Bulk actions (log to Warnings) =====
  async function autoAssignShipments() {
    try {
      const res = await fetch('/api/voyages/auto-assign', { method: 'POST' })
      const data = await res.json().catch(()=>({}))
      if (!res.ok || data.error) return alert(data.error || 'Auto-assign failed')

      const pairs = coercePairsFromPayload(data, data.messages || [])
      setReports(rs => [
        {
          id: crypto.randomUUID(),
          time: Date.now(),
          source: 'auto',
          assigned: data.count ?? data.assignedCount ?? pairs.length ?? 0,
          processed: data.processed ?? 0,
          pairs,
          messages: data.messages || [],
        },
        ...rs
      ])
      alert(`Auto-assigned ${data.count ?? data.assignedCount ?? pairs.length ?? 0} shipments`)
      setTab('warnings'); load()
    } catch { alert('Network error while auto-assigning') }
  }

  async function aiAutoAssign() {
    try {
      const res = await fetch('/api/voyages/ai-assign', { method: 'POST' })
      const data = await res.json().catch(()=>({}))
      const pairs = coercePairsFromPayload(data, data.messages || [])

      setReports(rs => [
        {
          id: crypto.randomUUID(),
          time: Date.now(),
          source: 'ai',
          assigned: data.assigned ?? pairs.length ?? 0,
          processed: data.processed ?? 0,
          pairs,
          messages: data.messages || [],
        },
        ...rs
      ])

      alert(`AI assigned ${data.assigned ?? pairs.length ?? 0} / ${data.processed ?? 0}`)
      setTab('warnings'); load()
    } catch { alert('AI auto-assign failed') }
  }

  const baseInput = "input w-full"

  return (
    <div className="grid gap-6">
      <DynamicBackground
              image="/login.webp"                                /* put file in /public/login.webp */
              overlay="linear-gradient(180deg, rgba(0,0,0,.25), rgba(0,0,0,.55))"
              blur="0px"
              attachment="fixed"                                  /* stays while scrolling */
            />
      {/* ===== Top Tabs ===== */}
      <div className="card p-2 flex gap-2">
        <button className={`btn ${tab==='add' ? '' : 'btn-ghost'}`} onClick={() => setTab('add')}>Add Shipment</button>
        <button className={`btn ${tab==='manage' ? '' : 'btn-ghost'}`} onClick={() => setTab('manage')}>Manage Shipments</button>
        <button className={`btn ${tab==='ai' ? '' : 'btn-ghost'}`} onClick={() => setTab('ai')}>AI</button>
        <button className={`btn ${tab==='warnings' ? '' : 'btn-ghost'}`} onClick={() => setTab('warnings')}>Warnings</button>
      </div>

      {/* ===== ADD SHIPMENT ===== */}
      {tab === 'add' && (
        <Card title="New Shipment">
          <form onSubmit={createShipment} className="grid md:grid-cols-3 gap-3">
            <Input placeholder="Shipment ID" value={form.shipmentId} onChange={e=>setForm({...form, shipmentId:e.target.value})} />
            <Input placeholder="Origin" value={form.origin} onChange={e=>setForm({...form, origin:e.target.value})} />
            <Input placeholder="Destination" value={form.destination} onChange={e=>setForm({...form, destination:e.target.value})} />
            <Input type="date" value={form.shipDate} onChange={e=>setForm({...form, shipDate:e.target.value})} />
            <Input type="number" min="0" value={form.transitDays} onChange={e=>setForm({...form, transitDays:e.target.value})} />
            <select className={baseInput} value={form.status} onChange={e=>setForm({...form, status:e.target.value})}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isPriority} onChange={e=>setForm({...form, isPriority:e.target.checked})} />
              Priority
            </label>

            <Input type="number" step="0.01" placeholder="Weight (tons)" value={form.weightTons ?? ''} onChange={e => setForm({ ...form, weightTons: e.target.value })} />
            <Input type="number" step="0.01" placeholder="Volume (m³)" value={form.volumeM3 ?? ''} onChange={e => setForm({ ...form, volumeM3: e.target.value })} />

            <Button type="submit" className="md:col-span-3">Create</Button>
          </form>
        </Card>
      )}

      {/* ===== MANAGE SHIPMENTS ===== */}
      {tab === 'manage' && (
        <Card title="Shipments">
          {/* Filters / Search / Sort */}
          <div className="mb-3 grid md:grid-cols-5 gap-3">
            <Input placeholder="Search (ID/origin/destination)" value={q} onChange={e=>{setQ(e.target.value); setPage(1)}} />
            <select className={baseInput} value={status} onChange={e=>{setStatus(e.target.value); setPage(1)}}>
              <option value="">All Status</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className={baseInput} value={isPriority} onChange={e=>{setIsPriority(e.target.value); setPage(1)}}>
              <option value="">Any Priority</option>
              <option value="true">Priority Only</option>
              <option value="false">Non-Priority</option>
            </select>
            <select className={baseInput} value={sortBy} onChange={e=>setSortBy(e.target.value)}>
              <option value="createdAt">Sort: Created</option>
              <option value="shipDate">Sort: Ship Date</option>
              <option value="shipmentId">Sort: Shipment ID</option>
              <option value="status">Sort: Status</option>
            </select>
            <select className={baseInput} value={order} onChange={e=>setOrder(e.target.value)}>
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>

          {/* Voyages quick actions */}
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Button variant="ghost" onClick={() => setShowVoyageForm(v => !v)}>
              {showVoyageForm ? 'Close Voyage Form' : 'Add Voyage'}
            </Button>
            <Button variant="ghost" onClick={autoAssignShipments}>Auto-assign Shipments</Button>
            <Button variant="ghost" onClick={aiAutoAssign}>AI Auto-Assign (AI)</Button>
          </div>

          {/* Inline Add Voyage */}
          {showVoyageForm && (
            <div className="card p-4 mb-3">
              <form onSubmit={createVoyage} className="grid md:grid-cols-3 gap-3">
                <Input placeholder="Voyage Code" value={voyageForm.voyageCode} onChange={e=>setVoyageForm({...voyageForm, voyageCode:e.target.value})} />
                <Input placeholder="Vessel Name" value={voyageForm.vesselName} onChange={e=>setVoyageForm({...voyageForm, vesselName:e.target.value})} />
                <Input placeholder="Origin" value={voyageForm.origin} onChange={e=>setVoyageForm({...voyageForm, origin:e.target.value})} />
                <Input placeholder="Destination" value={voyageForm.destination} onChange={e=>setVoyageForm({...voyageForm, destination:e.target.value})} />
                <Input type="date" placeholder="Depart At" value={voyageForm.departAt} onChange={e=>setVoyageForm({...voyageForm, departAt:e.target.value})} />
                <Input type="date" placeholder="Arrive By" value={voyageForm.arriveBy} onChange={e=>setVoyageForm({...voyageForm, arriveBy:e.target.value})} />
                <Input type="number" step="0.01" placeholder="Weight Cap (tons)" value={voyageForm.weightCapT} onChange={e=>setVoyageForm({...voyageForm, weightCapT:e.target.value})} />
                <Input type="number" step="0.01" placeholder="Volume Cap (m³)" value={voyageForm.volumeCapM3} onChange={e=>setVoyageForm({...voyageForm, volumeCapM3:e.target.value})} />

                <div className="md:col-span-3 flex gap-2">
                  <Button type="submit">Create Voyage</Button>
                  <Button type="button" variant="ghost" onClick={()=>setShowVoyageForm(false)}>Cancel</Button>
                </div>
              </form>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[rgb(var(--muted))]">
                <tr>
                  <th className="py-2 cursor-pointer" onClick={()=>toggleSort('shipmentId')}>Shipment ID</th>
                  <th className="py-2">Origin → Destination</th>
                  <th className="py-2 cursor-pointer" onClick={()=>toggleSort('shipDate')}>Ship Date</th>
                  <th className="py-2">Transit Days</th>
                  <th className="py-2">Wt (t)</th>
                  <th className="py-2">Vol (m³)</th>
                  <th className="py-2 cursor-pointer" onClick={()=>toggleSort('status')}>Status</th>
                  <th className="py-2">Priority</th>
                  <th className="py-2">Est. Delivery</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(s => (
                  <tr key={s.id} className="border-t border-white/10">
                    <td className="py-2">{s.shipmentId}</td>
                    <td className="py-2">{s.origin} → {s.destination}</td>
                    <td className="py-2">{new Date(s.shipDate).toLocaleDateString()}</td>
                    <td className="py-2">{s.transitDays}</td>
                    <td className="py-2">{s.weightTons ?? '-'}</td>
                    <td className="py-2">{s.volumeM3 ?? '-'}</td>
                    <td className="py-2">{s.status}</td>
                    <td className="py-2">{s.isPriority ? 'Yes' : 'No'}</td>
                    <td className="py-2">{s.estimatedDelivery ? new Date(s.estimatedDelivery).toLocaleDateString() : '-'}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        <button className="btn btn-ghost" onClick={()=>del(s.id)}>Delete</button>
                        <button className="btn btn-ghost" onClick={()=>openEvents(s)}>
                          {openShipmentId === s.id ? 'Hide Events' : 'Events'}
                        </button>
                        <button className="btn btn-ghost" onClick={()=>predictETA(s)} disabled={etaLoadingId === s.id}>
                          {etaLoadingId === s.id ? 'ETA…' : 'ETA+'}
                        </button>

                        {/* Assign (strict) */}
                        {!s.assignedVoyage ? (
                          <button
                            className="btn btn-ghost"
                            onClick={async () => {
                              const res = await fetch(`/api/shipments/${s.id}/assign`, { method: 'POST' })
                              const data = await res.json().catch(()=>({}))
                              if (!res.ok || data.error) return alert(data.error || 'Assign failed')
                              if (data.alreadyAssigned) return alert('Already assigned')

                              const vc = data.voyageCode || (data.voyage && data.voyage.voyageCode)
                              setReports(rs => [
                                {
                                  id: crypto.randomUUID(),
                                  time: Date.now(),
                                  source: 'assign',
                                  assigned: data.ok ? 1 : 0,
                                  processed: 1,
                                  pairs: data.ok && vc ? [{ shipmentId: s.shipmentId, voyageCode: vc }] : [],
                                  messages: [data.ok ? `✅ ${s.shipmentId} → ${vc}` : (data.reason || 'No match')],
                                },
                                ...rs
                              ])

                              if (data.ok && vc) alert(`Assigned to ${vc}`)
                              if (data.ok === false && data.reason) alert(data.reason)
                              load()
                            }}
                          >
                            Assign
                          </button>
                        ) : (
                          <button className="btn btn-ghost" disabled>
                            Assigned ({s.assignedVoyage.voyageCode})
                          </button>
                        )}

                        {/* AI Assign (single) */}
                        {!s.assignedVoyage && (
                          <button
                            className="btn btn-ghost"
                            onClick={async () => {
                              const res = await fetch(`/api/shipments/${s.id}/ai-assign`, { method: 'POST' })
                              const data = await res.json().catch(()=>({}))
                              if (!res.ok || data.error) return alert(data.error || 'AI assign failed')
                              if (data.alreadyAssigned) return alert('Already assigned')

                              if (data.ok && data.voyageCode) {
                                const vc = data.voyageCode
                                setReports(rs => [
                                  {
                                    id: crypto.randomUUID(),
                                    time: Date.now(),
                                    source: 'ai-assign',
                                    assigned: 1, processed: 1,
                                    pairs: [{ shipmentId: s.shipmentId, voyageCode: vc }],
                                    messages: [`✅ ${s.shipmentId} → ${vc}`].concat(data.why ? [`Why: ${data.why}`] : []),
                                  },
                                  ...rs
                                ])
                                alert(`AI assigned to ${vc}${data.why ? `\n\nWhy: ${data.why}` : ''}`)
                                load()
                              } else {
                                const hint = data.planHint || data.why || 'No direct lane. Try multi-leg via nearby ports.'
                                setReports(rs => [
                                  {
                                    id: crypto.randomUUID(),
                                    time: Date.now(),
                                    source: 'ai-assign',
                                    assigned: 0, processed: 1, pairs: [],
                                    messages: [hint],
                                  },
                                  ...rs
                                ])
                                alert(hint)
                              }
                            }}
                          >
                            AI Assign
                          </button>
                        )}

                        {/* Unassign */}
                        {s.assignedVoyage && (
                          <button
                            className="btn btn-ghost"
                            onClick={async () => {
                              if (!confirm(`Unassign from ${s.assignedVoyage.voyageCode}?`)) return
                              const res = await fetch(`/api/voyages/${s.assignedVoyage.id}/assign?shipmentId=${s.id}`, { method: 'DELETE' })
                              const data = await res.json().catch(()=>({}))
                              if (!res.ok || data.error) return alert(data.error || 'Unassign failed')

                              setReports(rs => [
                                {
                                  id: crypto.randomUUID(),
                                  time: Date.now(),
                                  source: 'assign',
                                  assigned: 0, processed: 1, pairs: [],
                                  messages: [`ℹ️ ${s.shipmentId} unassigned from ${s.assignedVoyage.voyageCode}`],
                                },
                                ...rs
                              ])
                              alert('Unassigned'); load()
                            }}
                          >
                            Unassign
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={10} className="py-6 text-center text-[rgb(var(--muted))]">No shipments</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Inline ETA result (Manage tab) */}
          {etaResultId && (
            <div className="mt-3 card p-4 whitespace-pre-wrap text-sm">
              <div className="mb-2 text-[rgb(var(--muted))]">AI ETA+ for selected shipment</div>
              {etaResult}
            </div>
          )}

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[rgb(var(--muted))]">Rows:</span>
              <select className="input w-24" value={limit} onChange={e=>{setLimit(Number(e.target.value)); setPage(1)}}>
                {[5,10,20,30,50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={()=>setPage(p=>Math.max(1, p-1))} disabled={page<=1}>Prev</Button>
              <span className="text-xs text-[rgb(var(--muted))]">Page {page} / {totalPages}</span>
              <Button variant="ghost" onClick={()=>setPage(p=>Math.min(totalPages, p+1))} disabled={page>=totalPages}>Next</Button>
            </div>
          </div>

          {/* Events Panel */}
          {openShipmentId && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm text-[rgb(var(--muted))]">Tracking Events</h3>
              <div className="grid md:grid-cols-4 gap-3">
                <select className={baseInput} value={evForm.eventType} onChange={e=>setEvForm({...evForm, eventType:e.target.value})}>
                  {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <Input placeholder="Location" value={evForm.location} onChange={e=>setEvForm({...evForm, location:e.target.value})} />
                <Input placeholder="Occurred At (optional YYYY-MM-DD or ISO)" value={evForm.occurredAt} onChange={e=>setEvForm({...evForm, occurredAt:e.target.value})} />
                <Input placeholder="Notes (optional)" value={evForm.notes} onChange={e=>setEvForm({...evForm, notes:e.target.value})} />
                <Button className="md:col-span-4" variant="ghost" onClick={addEvent} disabled={evLoading}>
                  {evLoading ? 'Adding…' : 'Add Event'}
                </Button>
              </div>

              <div className="mt-4 card p-4">
                {evLoading && !events.length ? (
                  <p className="text-sm text-[rgb(var(--muted))]">Loading events…</p>
                ) : events.length === 0 ? (
                  <p className="text-sm text-[rgb(var(--muted))]">No events yet</p>
                ) : (
                  <ul className="space-y-2">
                    {events.map(ev => (
                      <li key={ev.id} className="grid md:grid-cols-5 gap-2 text-sm border-b border-white/10 pb-2">
                        <span className="font-medium">{ev.eventType}</span>
                        <span className="md:col-span-2 text-[rgb(var(--muted))]">{ev.location}</span>
                        <span className="text-[rgb(var(--muted))]">{new Date(ev.occurredAt).toLocaleString()}</span>
                        <span className="text-[rgb(var(--muted))] truncate">{ev.notes || ''}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ===== AI TAB ===== */}
      {tab === 'ai' && (
        <>
          <Card title="AI Tools (Plan Hint & FFD)">
            <div className="mb-3 grid md:grid-cols-6 gap-3">
              <Input placeholder="From (Origin) — optional" value={aiFilter.origin} onChange={e=>setAiFilter(v=>({...v, origin: e.target.value}))} />
              <Input placeholder="To (Destination) — optional" value={aiFilter.destination} onChange={e=>setAiFilter(v=>({...v, destination: e.target.value}))} />
              <Input type="date" placeholder="Start on/after (optional)" value={aiFilter.startAfter} onChange={e=>setAiFilter(v=>({...v, startAfter: e.target.value}))} />
              <Input placeholder="Vessel Weight Cap (optional)" value={vessel.weightCap} onChange={e=>setVessel(v=>({...v, weightCap: e.target.value}))} />
              <Input placeholder="Vessel Volume Cap (optional)" value={vessel.volumeCap} onChange={e=>setVessel(v=>({...v, volumeCap: e.target.value}))} />
              <div className="flex gap-2">
                <Button variant="ghost" onClick={getPlanHint} disabled={aiLoading}>{aiLoading ? 'Getting AI Hint…' : 'AI Plan Hint'}</Button>
                <Button variant="ghost" onClick={runFFD}>Run FFD Plan</Button>
              </div>
            </div>

            {aiHint && (
              <div className="mt-4 card p-4 whitespace-pre-wrap text-sm">
                <div className="mb-2 text-[rgb(var(--muted))]">AI Plan Hint</div>
                {aiHint}
              </div>
            )}
            {etaResultId && (
              <div className="mt-2 card p-4 whitespace-pre-wrap text-sm">
                <div className="mb-2 text-[rgb(var(--muted))]">AI ETA+ for selected shipment</div>
                {etaResult}
              </div>
            )}
            {ffdOut && !ffdOut.loading && (
              <div className="mt-4 card p-4 text-sm">
                <div className="mb-2 text-[rgb(var(--muted))]">FFD Plan</div>
                <div>Assigned: {Array.isArray(ffdOut.assigned) ? ffdOut.assigned.join(', ') : '-'}</div>
                <div>
                  Skipped: {Array.isArray(ffdOut.skipped) && ffdOut.skipped.length ? ffdOut.skipped.map(s => `${s.shipmentId}(${s.reason})`).join(', ') : 'None'}
                </div>
                {ffdOut.utilization && (
                  <div className="mt-2">
                    Utilization: {ffdOut.utilization.weight ?? '-'}% weight, {ffdOut.utilization.volume ?? '-'}% volume
                  </div>
                )}
              </div>
            )}
          </Card>

          <AIConsole title="AI Console — Shipments" defaultUseDb={true} />
        </>
      )}

      {/* ===== WARNINGS TAB ===== */}
      {tab === 'warnings' && (
        <Card title="Assignment Reports">
          {!reports.length ? (
            <div className="text-sm text-[rgb(var(--muted))]">No reports yet. Use Assign / AI Assign / Auto-assign.</div>
          ) : (
            <div className="space-y-4">
              {reports.map(r => (
                <div key={r.id} className="card p-3">
                  <div className="text-sm mb-2">
                    <div><span className="text-[rgb(var(--muted))]">When:</span> {fmtTime(r.time)}</div>
                    <div><span className="text-[rgb(var(--muted))]">Source:</span> {r.source.toUpperCase()}</div>
                    <div><span className="text-[rgb(var(--muted))]">Assigned / Processed:</span> {r.assigned} / {r.processed}</div>
                  </div>

                  <div className="mb-2 text-[rgb(var(--muted))] text-sm">Shipment → Voyage</div>
                  {r.pairs.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-[rgb(var(--muted))]">
                            <th className="py-2">Shipment</th>
                            <th className="py-2">Voyage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.pairs.map((p, idx) => (
                            <tr key={idx} className="border-t border-white/10">
                              <td className="py-2">{p.shipmentId}</td>
                              <td className="py-2">{p.voyageCode}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <div className="text-sm text-[rgb(var(--muted))]">No successful pairs parsed.</div>}

                  {Array.isArray(r.messages) && r.messages.length > 0 && (
                    <div className="mt-3">
                      <div className="mb-1 text-[rgb(var(--muted))] text-sm">Messages</div>
                      <ul className="space-y-1 text-sm">
                        {r.messages.map((m, i) => <li key={i} className="border-b border-white/10 pb-2">{m}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              ))}

              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setReports([])}>Clear all</Button>
                <Button variant="ghost" onClick={() => setTab('manage')}>Back to Manage</Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
