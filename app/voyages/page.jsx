'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

export default function VoyagesPage() {
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')

  const [form, setForm] = useState({
    voyageCode: '', vesselName: '', origin: '', destination: '',
    departAt: '', arriveBy: '', weightCapT: '', volumeCapM3: ''
  })

  const [planMsg, setPlanMsg] = useState('')
  const [planOut, setPlanOut] = useState(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    const params = new URLSearchParams({ page, limit, ...(q?{q}:{}) })
    const res = await fetch(`/api/voyages?${params}`)
    const data = await res.json()
    setItems(data.items || []); setTotal(data.total || 0)
  }

  useEffect(() => { load() }, [page, limit, q])

  async function createVoyage(e) {
    e.preventDefault()
    const res = await fetch('/api/voyages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    if (res.ok) {
      setForm({ voyageCode:'', vesselName:'', origin:'', destination:'', departAt:'', arriveBy:'', weightCapT:'', volumeCapM3:'' })
      setPage(1); load()
    } else {
      const err = await res.json().catch(()=>({}))
      alert(err.error || 'Create failed')
    }
  }

  async function plan(id, commit=false) {
    setLoading(true); setPlanMsg(commit ? 'Applying plan…' : 'Planning…')
    try {
      const res = await fetch(`/api/voyages/${id}/plan${commit?'?commit=true':''}`, { method: 'POST' })
      const data = await res.json()
      setPlanOut(data)
      if (commit) load()
    } finally {
      setLoading(false); setPlanMsg('')
    }
  }

  async function del(id) {
    if (!confirm('Delete voyage?')) return
    await fetch(`/api/voyages/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="grid gap-6">
      <Card title="New Voyage">
        <form onSubmit={createVoyage} className="grid md:grid-cols-3 gap-3">
          <Input placeholder="Voyage Code" value={form.voyageCode} onChange={e=>setForm({...form, voyageCode:e.target.value})} />
          <Input placeholder="Vessel Name" value={form.vesselName} onChange={e=>setForm({...form, vesselName:e.target.value})} />
          <Input placeholder="Origin" value={form.origin} onChange={e=>setForm({...form, origin:e.target.value})} />
          <Input placeholder="Destination" value={form.destination} onChange={e=>setForm({...form, destination:e.target.value})} />
          <Input type="datetime-local" placeholder="Depart At" value={form.departAt} onChange={e=>setForm({...form, departAt:e.target.value})} />
          <Input type="datetime-local" placeholder="Arrive By" value={form.arriveBy} onChange={e=>setForm({...form, arriveBy:e.target.value})} />
          <Input type="number" step="0.01" placeholder="Weight Cap (t)" value={form.weightCapT} onChange={e=>setForm({...form, weightCapT:e.target.value})} />
          <Input type="number" step="0.01" placeholder="Volume Cap (m³)" value={form.volumeCapM3} onChange={e=>setForm({...form, volumeCapM3:e.target.value})} />
          <Button type="submit" className="md:col-span-3">Create</Button>
        </form>
      </Card>

      <Card title="Voyages">
        <div className="mb-3 flex gap-3">
          <Input placeholder="Search voyages…" value={q} onChange={e=>{setQ(e.target.value); setPage(1)}} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[rgb(var(--muted))]">
              <tr>
                <th className="py-2">Voyage</th>
                <th className="py-2">Vessel</th>
                <th className="py-2">Route</th>
                <th className="py-2">Depart → Arrive</th>
                <th className="py-2">Caps</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(v => (
                <tr key={v.id} className="border-t border-white/10">
                  <td className="py-2">{v.voyageCode}</td>
                  <td className="py-2">{v.vesselName}</td>
                  <td className="py-2">{v.origin} → {v.destination}</td>
                  <td className="py-2">
                    {new Date(v.departAt).toLocaleString()} → {new Date(v.arriveBy).toLocaleString()}
                  </td>
                  <td className="py-2">
                    {v.weightCapT ?? '-'}t / {v.volumeCapM3 ?? '-'}m³
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      <button className="btn btn-ghost" onClick={()=>plan(v.id, false)} disabled={loading}>Plan with AI</button>
                      <button className="btn btn-ghost" onClick={()=>plan(v.id, true)} disabled={loading}>Apply Plan</button>
                      <button className="btn btn-ghost" onClick={()=>del(v.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-[rgb(var(--muted))]">No voyages</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {planMsg && <div className="mt-3 text-sm text-[rgb(var(--muted))]">{planMsg}</div>}
        {planOut && (
          <div className="mt-4 card p-4 text-sm whitespace-pre-wrap">
            <div className="mb-2 text-[rgb(var(--muted))]">AI Plan Preview</div>
            <div>{planOut.hint || '(no hint)'}</div>
            <div className="mt-2">Assigned: {planOut.assigned?.join(', ') || '-'}</div>
            <div>Skipped: {planOut.skipped?.map(s => `${s.shipmentId}(${s.reason})`).join(', ') || 'None'}</div>
            {planOut.utilization && (
              <div className="mt-2">
                Utilization: {planOut.utilization.weight ?? '-'}% weight, {planOut.utilization.volume ?? '-'}% volume
              </div>
            )}
            {planOut.committed ? <div className="mt-2 text-emerald-400">Assignments saved.</div> : null}
          </div>
        )}
      </Card>
    </div>
  )
}
