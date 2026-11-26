import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '../../../../lib/admin-session'
import { DJ_ELECTION_CLOSES_AT, DJ_ELECTION_OPENS_AT, getElectionState } from '../../../../lib/dj-election'
import { supabaseRequest } from '../../../../lib/supabase-rest'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const response = await supabaseRequest('/rest/v1/rpc/get_dj_results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }).catch(() => null)

  if (!response?.ok) return NextResponse.json({ error: 'Could not load DJ results.' }, { status: 503 })
  const candidates = await response.json()
  const totalVotes = candidates.reduce((total: number, candidate: { vote_count: number }) => total + Number(candidate.vote_count), 0)
  const state = getElectionState()
  const highestVotes = candidates.length ? Number(candidates[0].vote_count) : 0
  const tiedLeaders = candidates.filter((candidate: { vote_count: number }) => Number(candidate.vote_count) === highestVotes)
  const winner = state === 'closed' && highestVotes > 0 && tiedLeaders.length === 1 ? tiedLeaders[0] : null

  return NextResponse.json({
    candidates,
    totalVotes,
    state,
    winner,
    isTie: state === 'closed' && highestVotes > 0 && tiedLeaders.length > 1,
    opensAt: DJ_ELECTION_OPENS_AT.toISOString(),
    closesAt: DJ_ELECTION_CLOSES_AT.toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
