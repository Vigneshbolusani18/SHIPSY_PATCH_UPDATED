import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcrypt'
import { signJWT } from '@/lib/jwt'

export async function POST(req) {
  try {
    const { username, password } = await req.json()
    if (!username || !password)
      return NextResponse.json({ error: 'username and password required' }, { status: 400 })

    const user = await prisma.user.findUnique({ where: { username } })
    if (!user) return NextResponse.json({ error: 'invalid credentials' }, { status: 401 })

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) return NextResponse.json({ error: 'invalid credentials' }, { status: 401 })

    const token = signJWT({ sub: user.id, username: user.username })
    const res = NextResponse.json({ message: 'ok' })
    res.cookies.set('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })
    return res
  } catch {
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}
