import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '../../../../lib/admin-session'
import {
  attachVoterCookie,
  createOrReadVoterToken,
  getElectionState,
  hashVoterToken,
  jsonForVoter,
} from '../../../../lib/dj-election'
import { publicDjArtworkUrl, supabaseRequest } from '../../../../lib/supabase-rest'

export const runtime = 'nodejs'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function detectedImage(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', extension: 'jpg' }
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return { mime: 'image/png', extension: 'png' }
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) {
    return { mime: 'image/webp', extension: 'webp' }
  }
  return null
}

async function removeArtwork(path: string) {
  await supabaseRequest('/storage/v1/object/dj-artwork/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: [path] }),
  }).catch(() => undefined)
}

export async function GET(request: NextRequest) {
  const voter = createOrReadVoterToken(request)
  try {
    const candidatesResponse = await supabaseRequest(
      '/rest/v1/dj_candidates?select=id,name,artwork_url,created_at&order=created_at.asc',
    )
    if (!candidatesResponse.ok) {
      return jsonForVoter(request, { error: 'Could not load DJs.' }, 503, voter)
    }
    const candidates = await candidatesResponse.json()
    const voterQuery = new URLSearchParams({
      select: 'candidate_id',
      voter_key: `eq.${hashVoterToken(voter.token)}`,
      limit: '1',
    })
    const voteResponse = await supabaseRequest(`/rest/v1/dj_votes?${voterQuery.toString()}`)
    if (!voteResponse.ok) return jsonForVoter(request, { error: 'Could not check vote status.' }, 503, voter)
    const votes = await voteResponse.json()
    const response = jsonForVoter(request, {
      candidates,
      state: getElectionState(),
      hasVoted: votes.length > 0,
      votedCandidateId: votes[0]?.candidate_id ?? null,
      opensAt: '2026-12-01T00:00:00+02:00',
      closesAt: '2026-12-30T23:59:59+02:00',
    }, 200, voter)
    return response
  } catch {
    return jsonForVoter(request, { error: 'The DJ list is temporarily unavailable.' }, 503, voter)
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid upload form.' }, { status: 400 })
  }

  const name = String(form.get('name') ?? '').trim()
  const artwork = form.get('artwork')
  if (!name || name.length > 120) {
    return NextResponse.json({ error: 'Enter a DJ name up to 120 characters.' }, { status: 400 })
  }
  if (!(artwork instanceof File) || artwork.size === 0 || artwork.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Choose an image up to 5 MB.' }, { status: 400 })
  }

  const bytes = new Uint8Array(await artwork.arrayBuffer())
  const image = detectedImage(bytes)
  if (!image) {
    return NextResponse.json({ error: 'Use a valid JPEG, PNG, or WebP image.' }, { status: 400 })
  }

  const id = randomUUID()
  const artworkPath = `${id}.${image.extension}`
  const uploadResponse = await supabaseRequest(
    `/storage/v1/object/dj-artwork/${encodeURIComponent(artworkPath)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': image.mime,
        'Cache-Control': '31536000',
        'x-upsert': 'false',
      },
      body: new Blob([bytes], { type: image.mime }),
    },
  ).catch(() => null)

  if (!uploadResponse?.ok) {
    return NextResponse.json({ error: 'Could not upload the DJ artwork.' }, { status: 502 })
  }

  const artworkUrl = publicDjArtworkUrl(artworkPath)
  const insertResponse = await supabaseRequest('/rest/v1/dj_candidates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ id, name, artwork_path: artworkPath, artwork_url: artworkUrl }),
  }).catch(() => null)

  if (!insertResponse?.ok) {
    await removeArtwork(artworkPath)
    return NextResponse.json({ error: 'Could not save this DJ.' }, { status: 502 })
  }

  const rows = await insertResponse.json()
  return NextResponse.json({ candidate: rows[0] }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  const id = new URL(request.url).searchParams.get('id') ?? ''
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Invalid DJ id.' }, { status: 400 })

  const query = new URLSearchParams({ select: 'id,artwork_path', id: `eq.${id}`, limit: '1' })
  const candidateResponse = await supabaseRequest(`/rest/v1/dj_candidates?${query.toString()}`).catch(() => null)
  if (!candidateResponse?.ok) return NextResponse.json({ error: 'Could not find this DJ.' }, { status: 502 })
  const candidates = await candidateResponse.json()
  if (!candidates.length) return NextResponse.json({ error: 'DJ not found.' }, { status: 404 })

  const deleteQuery = new URLSearchParams({ id: `eq.${id}` })
  const deleteResponse = await supabaseRequest(`/rest/v1/dj_candidates?${deleteQuery.toString()}`, {
    method: 'DELETE',
  }).catch(() => null)
  if (!deleteResponse?.ok) return NextResponse.json({ error: 'Could not delete this DJ.' }, { status: 502 })

  await removeArtwork(candidates[0].artwork_path)
  return NextResponse.json({ ok: true })
}
