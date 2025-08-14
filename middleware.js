import { NextResponse } from 'next/server'

export function middleware(req) {
  const path = req.nextUrl.pathname
  const protectedPaths = ['/', '/shipments', '/voyages']
  const needsAuth = protectedPaths.some(p => path === p || path.startsWith(p + '/'))

  if (!needsAuth) return NextResponse.next()

  const token = req.cookies.get('token')?.value
  if (!token) {
    const url = new URL('/login', req.url)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/shipments/:path*', '/voyages/:path*'],
}
