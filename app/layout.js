// app/layout.js
import './globals.css'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/jwt'
import { prisma } from '@/lib/db'
import LogoutButton from '@/components/LogoutButton'
import Link from 'next/link'

export const metadata = { title: 'SHIPSY' }

export default async function RootLayout({ children }) {
  // Next.js 15 dynamic APIs
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value

  let user = null
  if (token) {
    try {
      const payload = verifyJWT(token) // { sub, username }
      user = await prisma.user.findUnique({ where: { id: payload.sub } })
    } catch {
      user = null
    }
  }

  return (
    <html lang="en">
      <body className="min-h-screen text-black">
        <header className="sticky top-0 z-50 border-b border-white/10 bg-black/30 backdrop-blur">
          <div className="mx-auto max-w-6xl px-4 flex h-14 items-center justify-between">
            <Link
              href="/"
              className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-sky-600 via-cyan-500 to-emerald-400 bg-clip-text text-transparent tracking-wide drop-shadow-lg hover:scale-[1.02] transition-transform"
            >
              Smart Freight &amp; Storage Planner
            </Link>

            <nav className="flex items-center gap-3 text-sm">
              {user ? (
                <>
                  <span className="hidden md:inline text-[rgb(var(--muted))]">Hi, {user.username}</span>
                  <LogoutButton />
                </>
              ) : (
                <>
                  <Link href="/login" className="btn btn-ghost">Login</Link>
                  <Link href="/register" className="btn btn-primary">Sign up</Link>
                </>
              )}
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>

        <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-[rgb(var(--muted))]">
          Built for the Shipsy assignment
        </footer>
      </body>
    </html>
  )
}
