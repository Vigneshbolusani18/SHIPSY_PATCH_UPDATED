'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import DynamicBackground from '@/components/DynamicBackground'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setErr('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (res.ok) {
      router.replace('/')
      router.refresh()
    } else {
      setErr((await res.json()).error || 'Login failed')
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      {/* Background for this page only */}
      <DynamicBackground
        image="/login.webp"
        overlay="linear-gradient(180deg, rgba(0,0,0,.25), rgba(0,0,0,.55))"
        blur="0px"
        attachment="fixed"
      />

      <div className="w-full max-w-md">
        <Card title="Log in">
          <form onSubmit={onSubmit} className="space-y-3">
            <Input placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} />
            <Input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
            {err && <p className="text-red-400 text-sm">{err}</p>}
            <Button type="submit" className="w-full">Login</Button>
          </form>
          <p className="mt-3 text-sm text-[rgb(var(--muted))]">
            No account? <Link href="/register" className="underline">Register</Link>
          </p>
        </Card>
      </div>
    </div>
  )
}
