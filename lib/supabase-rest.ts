export function supabaseUrl(path = '') {
  const baseUrl = process.env.SUPABASE_URL
  if (!baseUrl) throw new Error('Supabase URL is not configured.')
  return `${baseUrl.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`
}

export async function supabaseRequest(path: string, init: RequestInit = {}) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) throw new Error('Supabase server key is not configured.')

  const headers = new Headers(init.headers)
  headers.set('apikey', serviceKey)
  headers.set('authorization', `Bearer ${serviceKey}`)

  return fetch(supabaseUrl(path), {
    ...init,
    headers,
    cache: 'no-store',
  })
}

export function publicDjArtworkUrl(path: string) {
  const safePath = path.split('/').map(encodeURIComponent).join('/')
  return supabaseUrl(`/storage/v1/object/public/dj-artwork/${safePath}`)
}
