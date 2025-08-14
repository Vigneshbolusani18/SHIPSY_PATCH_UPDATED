'use client'
import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

const STATUSES = ['CREATED','IN_TRANSIT','DELIVERED','RETURNED']

export default function ShipmentsPage() {
  // list/query state
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10) // change to 5 if you want
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [isPriority, setIsPriority] = useState('')
  const [sortBy, setSortBy] = useState('createdAt') // createdAt | shipDate | shipmentId | status
  const [order, setOrder] = useState('desc')

  // create form
  const [form, setForm] = useState({
    shipmentId: '',
    origin: '',
    destination: '',
    shipDate: '',
    transitDays: 7,
    status: 'CREATED',
    isPriority: false,
  })

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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      // reset, reload first page
      setForm({ shipmentId: '', origin: '', destination: '', shipDate: '', transitDays: 7, status: 'CREATED', isPriority: false })
      setPage(1)
      load()
    } else {
      const err = await res.json().catch(()=>({}))
      alert(err.error || 'Create failed')
    }
  }

  function toggleSort(col) {
    if (sortBy === col) setOrder(order === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setOrder('asc') }
  }

  async function del(id) {
    if (!confirm('Delete this shipment?')) return
    const res = await fetch(`/api/shipments/${id}`, { method: 'DELETE' })
    if (res.ok) load(); else alert('Delete failed')
  }

  return (
    <div className="grid gap-6">
      {/* CREATE */}
      <Card title="New Shipment">
        <form onSubmit={createShipment} className="grid md:grid-cols-3 gap-3">
          <Input placeholder="Shipment ID" value={form.shipmentId} onChange={e=>setForm({...form, shipmentId:e.target.value})} />
          <Input placeholder="Origin" value={form.origin} onChange={e=>setForm({...form, origin:e.target.value})} />
          <Input placeholder="Destination" value={form.destination} onChange={e=>setForm({...form, destination:e.target.value})} />
          <Input type="date" value={form.shipDate} onChange={e=>setForm({...form, shipDate:e.target.value})} />
          <Input type="number" min="0" value={form.transitDays} onChange={e=>setForm({...form, transitDays:e.target.value})} />
          <select className="input" value={form.status} onChange={e=>setForm({...form, status:e.target.value})}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isPriority} onChange={e=>setForm({...form, isPriority:e.target.checked})} />
            Priority
          </label>
          <Button type="submit" className="md:col-span-3">Create</Button>
        </form>
      </Card>

      {/* LIST */}
      <Card title="Shipments">
        {/* Controls */}
        <div className="mb-3 grid md:grid-cols-5 gap-3">
          <Input placeholder="Search (ID/origin/destination)" value={q} onChange={e=>{setQ(e.target.value); setPage(1)}} />
          <select className="input" value={status} onChange={e=>{setStatus(e.target.value); setPage(1)}}>
            <option value="">All Status</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input" value={isPriority} onChange={e=>{setIsPriority(e.target.value); setPage(1)}}>
            <option value="">Any Priority</option>
            <option value="true">Priority Only</option>
            <option value="false">Non-Priority</option>
          </select>
          <select className="input" value={sortBy} onChange={e=>setSortBy(e.target.value)}>
            <option value="createdAt">Sort: Created</option>
            <option value="shipDate">Sort: Ship Date</option>
            <option value="shipmentId">Sort: Shipment ID</option>
            <option value="status">Sort: Status</option>
          </select>
          <select className="input" value={order} onChange={e=>setOrder(e.target.value)}>
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[rgb(var(--muted))]">
              <tr>
                <th className="py-2 cursor-pointer" onClick={()=>toggleSort('shipmentId')}>Shipment ID</th>
                <th className="py-2">Origin → Destination</th>
                <th className="py-2 cursor-pointer" onClick={()=>toggleSort('shipDate')}>Ship Date</th>
                <th className="py-2">Transit Days</th>
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
                  <td className="py-2">{s.status}</td>
                  <td className="py-2">{s.isPriority ? 'Yes' : 'No'}</td>
                  <td className="py-2">{new Date(s.estimatedDelivery).toLocaleDateString()}</td>
                  <td className="py-2">
                    <button className="btn btn-ghost" onClick={()=>del(s.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-[rgb(var(--muted))]">
                    No shipments
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

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
      </Card>
    </div>
  )
}
