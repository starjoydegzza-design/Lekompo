import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
const ADMIN_PASSWORD = 'StarJoy Degzza for Vercel.!1'

function weekStart() {
  const now = new Date()
  const day = now.getUTCDay()
  const daysSinceMonday = (day + 6) % 7
  now.setUTCDate(now.getUTCDate() - daysSinceMonday)
  now.setUTCHours(0, 0, 0, 0)
  return now.toISOString().slice(0, 10)
}

function authorized(request: NextRequest) {
  return request.headers.get('x-admin-password') === ADMIN_PASSWORD
}

export async function GET(request: NextRequest) {
  const admin = authorized(request)
  const supabase = getSupabase()
  const { data: mixtapes, error } = await supabase
    .from('mixtapes')
    .select('id,title,video_url,artwork,week_start,created_at')
    .eq('week_start', weekStart())
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Could not load mixtapes.' }, { status: 500 })

  if (!admin) return NextResponse.json({ mixtapes: mixtapes ?? [] })
  const ids = (mixtapes ?? []).map((mix) => mix.id)
  const { data: votes } = ids.length
    ? await supabase.from('mixture_votes').select('mixtape_id').eq('week_start', weekStart()).in('mixtape_id', ids)
    : { data: [] }
  const counts = (votes ?? []).reduce<Record<string, number>>((result, vote) => {
    result[vote.mixtape_id] = (result[vote.mixtape_id] ?? 0) + 1
    return result
  }, {})
  return NextResponse.json({ mixtapes: (mixtapes ?? []).map((mix) => ({ ...mix, votes: counts[mix.id] ?? 0 })) })
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  const supabase = getSupabase()
  const body = await request.json().catch(() => null)
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  if (!title) return NextResponse.json({ error: 'A title is required.' }, { status: 400 })
  const { data, error } = await supabase.from('mixtapes').insert({
    title,
    video_url: typeof body.video_url === 'string' ? body.video_url.trim() : '',
    artwork: typeof body.artwork === 'string' ? body.artwork : '',
    week_start: weekStart(),
  }).select('id,title,video_url,artwork,week_start,created_at').single()
  if (error) return NextResponse.json({ error: 'Could not save mixtape.' }, { status: 500 })
  return NextResponse.json({ mixtape: data }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing mixtape id.' }, { status: 400 })
  const supabase = getSupabase()
  const { error } = await supabase.from('mixtapes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Could not delete mixtape.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
