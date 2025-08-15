'use client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import StatsGlass from '@/components/StatsGlass'

export default function Home() {
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <>
      <h1 className="mb-8 text-center text-5xl font-extrabold bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 bg-clip-text text-transparent drop-shadow-lg tracking-wide">
        Smart Freight & Storage Planner
      </h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Welcome">
          <p className="text-[rgb(var(--muted))]">
            You’re logged in. Use the links below to get started.
          </p>
          <div className="mt-4 flex gap-3">
            <a href="/shipments" className="btn btn-primary">Shipments</a>
            <a href="/voyages" className="btn btn-ghost">Voyages</a>
          </div>
        </Card>

        {/* Live glassy stats */}
        <StatsGlass title="Stats" />
      </div>
    </>
  )
}
