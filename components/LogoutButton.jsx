'use client'

export default function LogoutButton({ className = '' }) {
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }
  return (
    <button onClick={logout} className={`btn btn-primary ${className}`}>
      Logout
    </button>
  );
}
