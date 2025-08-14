import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/jwt'

export async function GET() {
  const token = cookies().get('token')?.value
  if (!token) return NextResponse.json({ authenticated: false }, { status: 401 })
  try {
    const payload = verifyJWT(token)
    return NextResponse.json({ authenticated: true, userId: payload.sub, username: payload.username })
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
}
