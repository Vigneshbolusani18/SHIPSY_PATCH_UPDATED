'use client';
import { useState } from 'react';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export default function AIConsolePage() {
  const [msg, setMsg] = useState('');
  const [useDb, setUseDb] = useState(true);
  const [out, setOut] = useState('');
  const [loading, setLoading] = useState(false);

  async function ask(e) {
    e.preventDefault();
    setLoading(true);
    setOut('Thinking…');
    try {
      const res = await fetch('/api/ai/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, useDb }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'AI error');
      setOut(data.text || '(no text)');
    } catch (e) {
      setOut(e.message || 'AI error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Card title="AI Console">
        <form onSubmit={ask} className="grid gap-3 md:grid-cols-6 items-start">
          <div className="md:col-span-5">
            <Input
              placeholder="Ask about shipments, voyages, delays, utilization…"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs flex items-center gap-2">
              <input type="checkbox" checked={useDb} onChange={(e)=>setUseDb(e.target.checked)} />
              Use database
            </label>
            <Button type="submit" disabled={loading}>
              {loading ? 'Asking…' : 'Ask'}
            </Button>
          </div>
        </form>

        <div className="mt-4 card p-4 whitespace-pre-wrap text-sm">
          {out || 'No answer yet'}
        </div>
      </Card>
    </div>
  );
}
