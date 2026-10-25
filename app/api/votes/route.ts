import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function isVotingOpen() {
  const day = new Date().getUTCDay()
  return day === 6 || day === 0
}

function weekStart() {
  const now = new Date()
  const daysSinceMonday = (now.getUTCDay() + 6) % 7
  now.setUTCDate(now.getUTCDate() - daysSinceMonday)
  now.setUTCHours(0, 0, 0, 0)
  return now.toISOString().slice(0, 10)
}

export async function POST(request: NextRequest) {
  if (!isVotingOpen()) {
    return NextResponse.json({ error: 'voting_closed' }, { status: 403 })
  }
  const body = await request.json().catch(() => null)
  const mixtapeId = typeof body?.mixtape_id === 'string' ? body.mixtape_id : ''
  const voterKey = typeof body?.voter_key === 'string' ? body.voter_key : ''
  if (!mixtapeId || voterKey.length < 16 || voterKey.length > 200) {
    return NextResponse.json({ error: 'Invalid vote.' }, { status: 400 })
  }
  const supabase = getSupabase()
  const { error } = await supabase.from('mixture_votes').insert({
    mixtape_id: mixtapeId,
    voter_key: voterKey,
    week_start: weekStart(),
  })
  if (error?.code === '23505') return NextResponse.json({ error: 'already_voted' }, { status: 409 })
  if (error) return NextResponse.json({ error: 'Could not record vote.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
