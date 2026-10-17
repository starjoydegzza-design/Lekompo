import { NextResponse } from "next/server"
import { adminAuthorized, getMixes } from "@/lib/redis-store"

export async function GET(request: Request) {
  if (!adminAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    return NextResponse.json(await getMixes())
  } catch {
    return NextResponse.json({ error: "Unable to load votes" }, { status: 500 })
  }
}
