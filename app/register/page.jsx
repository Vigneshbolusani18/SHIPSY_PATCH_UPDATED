'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import DynamicBackground from '@/components/DynamicBackground'

export default function RegisterPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setMsg('')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) {
        setMsg('Registered! Redirecting…')
        router.replace('/login')
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setMsg(data.error || 'Register failed')
      }
    } catch {
      setMsg('Network error')
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      {/* keep your existing register background */}
      <DynamicBackground
        image="/register.jpg"
        overlay="linear-gradient(180deg, rgba(0,0,0,.25), rgba(0,0,0,.55))"
        blur="0px"
        attachment="fixed"
      />

      <div className="w-full max-w-md">
        <Card title="Create your account">
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              placeholder="Username"
              value={username}
              onChange={e=>setUsername(e.target.value)}
            />
            <Input
              placeholder="Password"
              type="password"
              value={password}
              onChange={e=>setPassword(e.target.value)}
            />
            {msg && <p className="text-sm text-brand-200">{msg}</p>}
            <Button type="submit" className="w-full">Sign up</Button>
          </form>

          <p className="mt-3 text-sm text-[rgb(var(--muted))]">
            Have an account? <Link href="/login" className="underline">Log in</Link>
          </p>
        </Card>
      </div>
    </div>
  )
}
