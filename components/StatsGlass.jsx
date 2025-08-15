'use client'
import { useEffect, useState } from 'react'

export default function StatsGlass({ title = 'Stats', subtle = false }) {
  const [data, setData] = useState({ inTransit: 0, delivered: 0, priority: 0, loading: true })

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/stats/overview', { cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        if (mounted && res.ok) setData({ ...json, loading: false })
        else if (mounted) setData(d => ({ ...d, loading: false }))
      } catch {
        if (mounted) setData(d => ({ ...d, loading: false }))
      }
    })()
    return () => { mounted = false }
  }, [])

  const Box = ({ label, value }) => (
    <div className="p-6 rounded-2xl bg-white/40 dark:bg-white/20 backdrop-blur-md shadow-lg flex flex-col items-center">
      <div className="text-3xl font-extrabold">{data.loading ? '—' : value ?? 0}</div>
      <div className="mt-1 text-sm text-[rgb(var(--muted))]">{label}</div>
    </div>
  )

  return (
    <div
      className={[
        'rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl',
        subtle ? 'bg-white/20' : 'bg-white/30 dark:bg-white/10'
      ].join(' ')}
    >
      <h2 className="text-xl md:text-2xl font-semibold mb-5">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Box label="In Transit" value={data.inTransit} />
        <Box label="Delivered" value={data.delivered} />
        <Box label="Priority" value={data.priority} />
      </div>
      {!data.loading && data.lastUpdated && (
        <div className="mt-3 text-xs text-[rgb(var(--muted))]">
          Last updated: {new Date(data.lastUpdated).toLocaleString()}
        </div>
      )}
    </div>
  )
}
