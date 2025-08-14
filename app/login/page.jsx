'use client'
import { useState } from 'react';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    const res = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) window.location.href = '/';
    else setErr((await res.json()).error || 'Login failed');
  }

  return (
    <div className="mx-auto max-w-md">
      <Card title="Log in">
        <form onSubmit={onSubmit} className="space-y-3">
          <Input placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} />
          <Input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          {err && <p className="text-red-400">{err}</p>}
          <Button type="submit">Login</Button>
        </form>
        <p className="mt-3 text-sm text-[rgb(var(--muted))]">
          No account? <a href="/register">Register</a>
        </p>
      </Card>
    </div>
  );
}
