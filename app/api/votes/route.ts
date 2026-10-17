import { NextResponse } from "next/server"
import { getClientKey, getMixes, isVotingOpen, redisCommand, weekKey, saveMixes } from "@/lib/redis-store"

export async function POST(request: Request) {
  if (!isVotingOpen()) return NextResponse.json({ error: "Voting is closed" }, { status: 409 })
  const body = await request.json().catch(() => ({}))
  const id = String(body.id || "")
  if (!id) return NextResponse.json({ error: "Missing mix id" }, { status: 400 })
  const voteKey = `lekompo:vote:${weekKey()}:${getClientKey(request)}`
  try {
    const claimed = await redisCommand<string>(["SET", voteKey, id, "NX", "EX", 604800])
    if (claimed !== "OK") return NextResponse.json({ error: "You have already voted this week" }, { status: 409 })
    const mixes = await getMixes()
    const index = mixes.findIndex((mix) => mix.id === id)
    if (index === -1) return NextResponse.json({ error: "Mix not found" }, { status: 404 })
    mixes[index].votes += 1
    await saveMixes(mixes)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Unable to record vote" }, { status: 500 })
  }
}
