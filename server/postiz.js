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

function messageFromBody(body) {
  if (!body) return ''
  if (typeof body === 'string') return body
  if (Array.isArray(body)) return body.map(messageFromBody).filter(Boolean).join('; ')
  if (typeof body === 'object') {
    if (typeof body.msg === 'string') return body.msg
    if (typeof body.message === 'string') return body.message
    if (typeof body.error === 'string') return body.error
    if (body.error) return messageFromBody(body.error)
    if (body.errors) return messageFromBody(body.errors)
    return JSON.stringify(body)
  }
  return String(body)
}

async function postiz(apiKey, base, path, init = {}) {
  const res = await fetch(`${baseUrl(base)}${path}`, {
    ...init,
    headers: { ...headers(apiKey), ...(init.headers || {}) },
  })
  const body = await readBody(res)
  if (!res.ok) {
    const msg = messageFromBody(body) || res.statusText
    throw new Error(`Postiz ${res.status}: ${msg}`)
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
  return {
    path: String(body.path),
  }
}

export async function createPostizPost(apiKey, base, payload) {
  return postiz(apiKey, base, '/posts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function buildTikTokUploadPayload({ integrationId, caption, media, title, date }) {
  if (!integrationId) throw new Error('Pick a Postiz integration in Settings.')
  if (!media?.length) throw new Error('No rendered slides to upload.')
  if (media.length > 35) throw new Error('TikTok photo posts support at most 35 images.')

  return {
    type: 'schedule',
    creationMethod: 'CLI',
    date: date || new Date(Date.now() + 10 * 60_000).toISOString(),
    shortLink: true,
    tags: [],
    posts: [
      {
        integration: { id: integrationId },
        value: [
          {
            content: caption,
            image: media.map((item) => ({
              id: Math.random().toString(36).substring(7),
              path: item.path,
            })),
          },
        ],
        settings: {
          privacy_level: 'PUBLIC_TO_EVERYONE',
          duet: false,
          stitch: false,
          comment: true,
          autoAddMusic: 'no',
          brand_content_toggle: false,
          brand_organic_toggle: false,
          content_posting_method: 'UPLOAD',
        },
      },
    ],
  }
}
