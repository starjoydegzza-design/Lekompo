import { NextRequest, NextResponse } from 'next/server'
import {
  clearAdminSession,
  createAdminSession,
  isAdminPasswordValid,
  isAdminRequest,
} from '../../../../lib/admin-session'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { authenticated: isAdminRequest(request) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!isAdminPasswordValid(body?.password)) {
    return NextResponse.json({ error: 'Invalid password.' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  createAdminSession(response)
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  clearAdminSession(response)
  return response
}
