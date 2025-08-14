'use client'

export default function Home() {
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Smart Freight & Storage Planner</h1>
      <p>Welcome! You’re logged in.</p>
      <button onClick={logout} style={{ marginTop: 16 }}>Logout</button>
    </main>
  )
}
