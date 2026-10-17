const redisUrl = process.env.KV_REST_API_URL
const redisToken = process.env.KV_REST_API_TOKEN

export type Mix = {
  id: string
  title: string
  videoUrl: string
  artwork: string
  votes: number
  createdAt: number
}

function assertConfigured() {
  if (!redisUrl || !redisToken) throw new Error("Storage is not configured")
}

export async function redisCommand<T = unknown>(command: unknown[]) {
  assertConfigured()
  const response = await fetch(redisUrl!, {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`Storage request failed: ${response.status}`)
  const payload = (await response.json()) as { result: T }
  return payload.result
}

export async function getMixes(): Promise<Mix[]> {
  const value = await redisCommand<string | null>(["GET", "lekompo:mixes"])
  if (!value) return []
  try {
    return JSON.parse(value) as Mix[]
  } catch {
    return []
  }
}

export async function saveMixes(mixes: Mix[]) {
  await redisCommand(["SET", "lekompo:mixes", JSON.stringify(mixes)])
}

export function weekKey(date = new Date()) {
  const copy = new Date(date)
  const day = copy.getUTCDay()
  const daysSinceMonday = (day + 6) % 7
  copy.setUTCDate(copy.getUTCDate() - daysSinceMonday)
  copy.setUTCHours(0, 0, 0, 0)
  return copy.toISOString().slice(0, 10)
}

export function isVotingOpen(date = new Date()) {
  const day = date.getUTCDay()
  return day === 0 || day === 6
}

export function getClientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwarded || request.headers.get("x-real-ip") || "unknown"
}

export function adminAuthorized(request: Request) {
  const configuredPassword = process.env.ADMIN_PASSWORD || "StarJoy Degzza for Vercel.!1"
  return request.headers.get("x-admin-password") === configuredPassword
}
