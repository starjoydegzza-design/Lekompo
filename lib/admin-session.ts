import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

export const ADMIN_SESSION_COOKIE = 'blm_admin_session'
const SESSION_SECONDS = 8 * 60 * 60

function signature(expiresAt: string) {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) throw new Error('Admin session signing key is not configured.')
  return createHmac('sha256', secret).update(`blm-admin:${expiresAt}`).digest('base64url')
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export function isAdminPasswordValid(password: unknown) {
  const expected = process.env.ADMIN_PASSWORD
  if (typeof password !== 'string' || !expected) return false
  return constantTimeEqual(password, expected)
}

export function createAdminSession(response: NextResponse) {
  const expiresAt = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS)
  response.cookies.set(ADMIN_SESSION_COOKIE, `${expiresAt}.${signature(expiresAt)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_SECONDS,
  })
}

export function clearAdminSession(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
}

export function isAdminRequest(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (!token) return false

  const [expiresAt, suppliedSignature, extra] = token.split('.')
  if (!expiresAt || !suppliedSignature || extra || !/^\d+$/.test(expiresAt)) return false
  if (Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false

  try {
    return constantTimeEqual(suppliedSignature, signature(expiresAt))
  } catch {
    return false
  }
}
