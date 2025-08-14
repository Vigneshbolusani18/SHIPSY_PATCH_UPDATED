'use client'
import { useState } from 'react'

export default function LoginPage() {
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
      window.location.href = '/'
    } else {
      const data = await res.json().catch(() => ({}))
      setErr(data.error || 'Login failed')
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: '2rem auto', padding: 16 }}>
      <h1>Log in</h1>
      <form onSubmit={onSubmit}>
        <input placeholder="Username" value={username}
               onChange={e=>setUsername(e.target.value)}
               style={{display:'block', width:'100%', margin:'8px 0', padding:8}} />
        <input placeholder="Password" type="password" value={password}
               onChange={e=>setPassword(e.target.value)}
               style={{display:'block', width:'100%', margin:'8px 0', padding:8}} />
        {err && <p style={{color:'crimson'}}>{err}</p>}
        <button type="submit">Login</button>
      </form>
      <p style={{marginTop:8}}>No account? <a href="/register">Register</a></p>
    </main>
  )
}
