'use client'
import { useState } from 'react'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

export default function AIPlayground() {
  const [msg, setMsg] = useState('')
  const [out, setOut] = useState('')

  async function send(e) {
    e.preventDefault()
    setOut('Thinking…')
    const res = await fetch('/api/ai/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg }),
    })
    const data = await res.json()
    setOut(data.reply || data.error || 'No response')
  }

  return (
    <div className="grid gap-6">
      <Card title="Gemini Test">
        <form onSubmit={send} className="grid md:grid-cols-3 gap-3">
          <Input placeholder="Ask something…" value={msg} onChange={e=>setMsg(e.target.value)} />
          <Button type="submit">Send</Button>
        </form>
        <pre className="mt-4 whitespace-pre-wrap text-sm text-[rgb(var(--muted))]">{out}</pre>
      </Card>
    </div>
  )
}
