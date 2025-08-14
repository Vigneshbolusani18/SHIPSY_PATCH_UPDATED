// components/AIConsole.jsx
'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function AIConsole() {
  const [message, setMessage] = useState('')
  const [useDb, setUseDb] = useState(true)
  const [loading, setLoading] = useState(false)
  const [log, setLog] = useState([]) // [{role:'user'|'assistant', text:string}]

  async function ask(e) {
    e?.preventDefault?.()
    if (!message.trim()) return
    const userText = message.trim()
    setLog(l => [...l, { role: 'user', text: userText }])
    setMessage('')
    setLoading(true)
    try {
      const res = await fetch('/api/ai/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, useDb }),
      })
      const data = await res.json()
      if (!res.ok) {
        setLog(l => [...l, { role: 'assistant', text: data?.error || 'AI error' }])
      } else {
        setLog(l => [...l, { role: 'assistant', text: data?.text || '(no response)' }])
      }
    } catch {
      setLog(l => [...l, { role: 'assistant', text: 'Network error' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-4">
      <div className="mb-2 text-sm text-[rgb(var(--muted))]">AI Console</div>

      {/* transcript */}
      <div className="mb-3 max-h-64 overflow-auto space-y-2 text-sm">
        {log.length === 0 && (
          <div className="text-[rgb(var(--muted))]">
            Try questions like: “show delhi shipments”, “status of SHP-001”, “how many are in transit?”
          </div>
        )}
        {log.map((m, i) => (
          <div key={i}>
            <span className="font-medium">{m.role === 'user' ? 'You' : 'AI'}</span>:&nbsp;
            <span className={m.role === 'assistant' ? 'whitespace-pre-wrap' : ''}>{m.text}</span>
          </div>
        ))}
      </div>

      {/* input row */}
      <form onSubmit={ask} className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Ask something about your shipments or voyages…"
          value={message}
          onChange={e => setMessage(e.target.value)}
          className="flex-1"
        />
        <label className="flex items-center gap-2 text-xs text-[rgb(var(--muted))]">
          <input
            type="checkbox"
            checked={useDb}
            onChange={e => setUseDb(e.target.checked)}
          />
          Use database
        </label>
        <Button type="submit" variant="ghost" disabled={loading}>
          {loading ? 'Asking…' : 'Ask'}
        </Button>
      </form>
    </div>
  )
}
