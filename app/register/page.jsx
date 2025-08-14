'use client'
import { useState } from 'react';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setMsg('');
    const res = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    setMsg(res.ok ? 'Registered! Redirecting…' : (await res.json()).error || 'Register failed');
    if (res.ok) setTimeout(()=> (window.location.href = '/login'), 700);
  }

  return (
    <div className="mx-auto max-w-md">
      <Card title="Create your account">
        <form onSubmit={onSubmit} className="space-y-3">
          <Input placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} />
          <Input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          {msg && <p className="text-brand-300">{msg}</p>}
          <Button type="submit">Sign up</Button>
        </form>
        <p className="mt-3 text-sm text-[rgb(var(--muted))]">
          Have an account? <a href="/login">Log in</a>
        </p>
      </Card>
    </div>
  );
}
