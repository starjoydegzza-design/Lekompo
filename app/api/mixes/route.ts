import { NextResponse } from "next/server"
import { adminAuthorized, getMixes, saveMixes } from "@/lib/redis-store"

export async function GET() {
  try {
    const mixes = await getMixes()
    return NextResponse.json(mixes.map(({ votes: _votes, ...mix }) => mix))
  } catch {
    return NextResponse.json({ error: "Unable to load mixes" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!adminAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const body = await request.json()
    const title = String(body.title || "").trim()
    const videoUrl = String(body.videoUrl || "").trim()
    const artwork = String(body.artwork || "")
    if (!title) return NextResponse.json({ error: "A title is required" }, { status: 400 })
    if (artwork.length > 900_000) return NextResponse.json({ error: "Artwork must be smaller than 900KB" }, { status: 400 })
    const mixes = await getMixes()
    const mix = { id: `v_${crypto.randomUUID()}`, title, videoUrl, artwork, votes: 0, createdAt: Date.now() }
    await saveMixes([mix, ...mixes])
    return NextResponse.json(mix)
  } catch {
    return NextResponse.json({ error: "Unable to save mix" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  if (!adminAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing mix id" }, { status: 400 })
  try {
    await saveMixes((await getMixes()).filter((mix) => mix.id !== id))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Unable to delete mix" }, { status: 500 })
  }
}
