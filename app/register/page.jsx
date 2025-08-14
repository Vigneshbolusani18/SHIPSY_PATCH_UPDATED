'use client'
import { useState } from 'react'

export default function RegisterPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setMsg('')
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (res.ok) {
      setMsg('Registered! Redirecting to login…')
      setTimeout(()=> (window.location.href = '/login'), 700)
    } else {
      const data = await res.json().catch(() => ({}))
      setMsg(data.error || 'Register failed')
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: '2rem auto', padding: 16 }}>
      <h1>Register</h1>
      <form onSubmit={onSubmit}>
        <input placeholder="Username" value={username}
               onChange={e=>setUsername(e.target.value)}
               style={{display:'block', width:'100%', margin:'8px 0', padding:8}} />
        <input placeholder="Password" type="password" value={password}
               onChange={e=>setPassword(e.target.value)}
               style={{display:'block', width:'100%', margin:'8px 0', padding:8}} />
        {msg && <p>{msg}</p>}
        <button type="submit">Create account</button>
      </form>
      <p style={{marginTop:8}}>Have an account? <a href="/login">Log in</a></p>
    </main>
  )
}
