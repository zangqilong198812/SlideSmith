const DEFAULT_BASE = 'https://api.postiz.com/public/v1'

function baseUrl(value) {
  return String(value || DEFAULT_BASE).replace(/\/+$/, '')
}

function headers(apiKey) {
  if (!apiKey) throw new Error('Missing Postiz API key. Add it in Settings.')
  return { Authorization: apiKey }
}

async function readBody(res) {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return text
  }
}

async function postiz(apiKey, base, path, init = {}) {
  const res = await fetch(`${baseUrl(base)}${path}`, {
    ...init,
    headers: { ...headers(apiKey), ...(init.headers || {}) },
  })
  const body = await readBody(res)
  if (!res.ok) {
    const msg = body?.message || body?.error || body?.errors || (typeof body === 'string' ? body : '') || res.statusText
    throw new Error(`Postiz ${res.status}: ${Array.isArray(msg) ? msg.join('; ') : msg}`)
  }
  return body
}

export async function listIntegrations(apiKey, base) {
  const body = await postiz(apiKey, base, '/integrations')
  const rows = Array.isArray(body) ? body : body?.integrations || body?.data || []
  return rows.map((i) => ({
    id: String(i.id),
    name: String(i.name || i.username || i.profile || i.providerIdentifier || i.id),
    providerIdentifier: String(i.providerIdentifier || i.identifier || i.provider || ''),
    picture: i.picture || i.profilePicture || '',
    profile: i.profile || '',
    disabled: !!i.disabled,
  }))
}

export async function validatePostiz(apiKey, base) {
  await listIntegrations(apiKey, base)
  return true
}

export async function uploadPostizMedia(apiKey, base, { buffer, name, mimeType }) {
  const file = new File([buffer], name, { type: mimeType })
  const form = new FormData()
  form.append('file', file)
  const body = await postiz(apiKey, base, '/upload', {
    method: 'POST',
    body: form,
  })
  if (!body?.path) throw new Error('Postiz upload did not return a media path.')
  return body
}

export async function createPostizPost(apiKey, base, payload) {
  return postiz(apiKey, base, '/posts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function buildTikTokUploadPayload({ integrationId, caption, imagePaths, title, date }) {
  if (!integrationId) throw new Error('Pick a Postiz integration in Settings.')
  if (!imagePaths?.length) throw new Error('No rendered slides to upload.')
  if (imagePaths.length > 35) throw new Error('TikTok photo posts support at most 35 images.')

  return {
    type: 'now',
    date: date || new Date(Date.now() + 60_000).toISOString(),
    shortLink: false,
    tags: [],
    posts: [
      {
        integration: { id: integrationId },
        value: [
          {
            content: caption,
            image: imagePaths.map((path) => ({ path })),
          },
        ],
        settings: {
          __type: 'tiktok',
          title: String(title || '').slice(0, 90),
          privacy_level: 'PUBLIC_TO_EVERYONE',
          duet: false,
          stitch: false,
          comment: true,
          autoAddMusic: 'no',
          brand_content_toggle: false,
          brand_organic_toggle: false,
          video_made_with_ai: false,
          content_posting_method: 'UPLOAD',
        },
      },
    ],
  }
}
