'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import StatsGlass from '@/components/StatsGlass'
import DynamicBackground from '@/components/DynamicBackground'

export default function Home() {
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
    router.refresh()
  }

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        <DynamicBackground
          image="/login.webp"
          overlay="linear-gradient(180deg, rgba(0,0,0,.25), rgba(0,0,0,.55))"
          blur="0px"
          attachment="fixed"
        />
        <Card title="Welcome">
          <p className="text-[rgb(var(--muted))]">
            You’re logged in. Use the links below to get started.
          </p>
          <div className="mt-4 flex gap-3">
            <Link prefetch href="/shipments" className="btn btn-primary">Shipments</Link>
            <Link prefetch href="/voyages" className="btn btn-ghost">Voyages</Link>
            <button onClick={logout} className="btn btn-ghost">Logout</button>
          </div>
        </Card>

        {/* Live glassy stats */}
        <StatsGlass title="Stats" />
      </div>
    </>
  )
}
