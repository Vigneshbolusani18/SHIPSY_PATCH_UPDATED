import { NextResponse } from 'next/server'

export async function POST() {
  const res = NextResponse.json({ message: 'logged out' })
  res.cookies.set('token', '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}
