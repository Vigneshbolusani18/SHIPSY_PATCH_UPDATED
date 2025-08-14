import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcrypt'

export async function POST(req) {
  try {
    const { username, password } = await req.json()
    if (!username || !password)
      return NextResponse.json({ error: 'username and password required' }, { status: 400 })

    const exists = await prisma.user.findUnique({ where: { username } })
    if (exists) return NextResponse.json({ error: 'username taken' }, { status: 409 })

    const hash = await bcrypt.hash(password, 10)
    await prisma.user.create({ data: { username, passwordHash: hash } })
    return NextResponse.json({ message: 'registered' }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}
