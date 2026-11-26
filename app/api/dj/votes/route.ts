import { NextRequest, NextResponse } from 'next/server'
import { createOrReadVoterToken, getElectionState, hashVoterToken, jsonForVoter } from '../../../../lib/dj-election'
import { supabaseRequest } from '../../../../lib/supabase-rest'

export const runtime = 'nodejs'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  const voter = createOrReadVoterToken(request)
  if (getElectionState() !== 'open') {
    return jsonForVoter(request, { error: 'voting_closed', state: getElectionState() }, 403, voter)
  }

  const body = await request.json().catch(() => null)
  const candidateId = typeof body?.candidate_id === 'string' ? body.candidate_id : ''
  if (!UUID_PATTERN.test(candidateId)) {
    return jsonForVoter(request, { error: 'Choose a valid DJ.' }, 400, voter)
  }

  const response = await supabaseRequest('/rest/v1/rpc/cast_dj_vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_candidate_id: candidateId,
      p_voter_key: hashVoterToken(voter.token),
    }),
  }).catch(() => null)

  if (!response?.ok) return jsonForVoter(request, { error: 'Could not record your vote.' }, 503, voter)
  const result = await response.json().catch(() => null)
  if (result === 'ok') return jsonForVoter(request, { ok: true }, 200, voter)
  if (result === 'already_voted') {
    return jsonForVoter(request, { error: 'already_voted' }, 409, voter)
  }
  if (result === 'closed') return jsonForVoter(request, { error: 'voting_closed' }, 403, voter)
  if (result === 'invalid_candidate') {
    return jsonForVoter(request, { error: 'DJ not found.' }, 404, voter)
  }
  return jsonForVoter(request, { error: 'Could not record your vote.' }, 400, voter)
}
