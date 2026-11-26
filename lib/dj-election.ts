import { createHash, randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

export const DJ_VOTER_COOKIE = 'blm_dj_voter'
export const DJ_ELECTION_OPENS_AT = new Date('2026-12-01T00:00:00+02:00')
export const DJ_ELECTION_CLOSES_AT = new Date('2026-12-31T00:00:00+02:00')
const VOTER_COOKIE_SECONDS = 60 * 60 * 24 * 365
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function getElectionState(now = Date.now()): 'scheduled' | 'open' | 'closed' {
  if (now < DJ_ELECTION_OPENS_AT.getTime()) return 'scheduled'
  if (now < DJ_ELECTION_CLOSES_AT.getTime()) return 'open'
  return 'closed'
}

export function createOrReadVoterToken(request: NextRequest) {
  const existing = request.cookies.get(DJ_VOTER_COOKIE)?.value
  if (existing && UUID_PATTERN.test(existing)) return { token: existing, shouldSetCookie: false }
  return { token: randomUUID(), shouldSetCookie: true }
}

export function hashVoterToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function attachVoterCookie(response: NextResponse, token: string) {
  response.cookies.set(DJ_VOTER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: VOTER_COOKIE_SECONDS,
  })
  return response
}

export function jsonForVoter(
  request: NextRequest,
  payload: unknown,
  status = 200,
  tokenState = createOrReadVoterToken(request),
) {
  const response = NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
  if (tokenState.shouldSetCookie) attachVoterCookie(response, tokenState.token)
  return response
}
