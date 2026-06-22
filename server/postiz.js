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

export async function listPosts(apiKey, base) {
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - 30)
  const end = new Date(now)
  end.setDate(now.getDate() + 60)
  const params = new URLSearchParams({
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  })
  const body = await postiz(apiKey, base, `/posts?${params}`)
  return Array.isArray(body) ? body : body?.posts || body?.data || []
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

function safeTitle(title, caption, max = 100) {
  const value = String(title || caption || 'Slidesmith post')
    .replace(/\s+/g, ' ')
    .trim()
  return (value || 'Slidesmith post').slice(0, max)
}

function providerSettings(providerIdentifier, title, caption) {
  const provider = String(providerIdentifier || '').toLowerCase()
  if (!provider) throw new Error('Postiz integration is missing a provider identifier.')
  const postTitle = safeTitle(title, caption)

  switch (provider) {
    case 'tiktok':
      return {
        __type: 'tiktok',
        title: safeTitle(title, caption, 90),
        privacy_level: 'PUBLIC_TO_EVERYONE',
        duet: false,
        stitch: false,
        comment: true,
        autoAddMusic: 'yes',
        brand_content_toggle: false,
        brand_organic_toggle: false,
        video_made_with_ai: false,
        content_posting_method: 'UPLOAD',
      }
    case 'x':
      return { __type: 'x', who_can_reply_post: 'everyone' }
    case 'linkedin':
    case 'linkedin-page':
      return { __type: provider, post_as_images_carousel: false }
    case 'facebook':
      return { __type: 'facebook', post_type: 'post' }
    case 'instagram':
    case 'instagram-standalone':
      return { __type: provider, post_type: 'post' }
    case 'medium':
      return { __type: 'medium', title: postTitle, subtitle: postTitle, tags: [] }
    case 'devto':
      return { __type: 'devto', title: postTitle, tags: [] }
    case 'dribbble':
      return { __type: 'dribbble', title: postTitle }
    case 'youtube':
      return { __type: 'youtube', title: postTitle, type: 'private', selfDeclaredMadeForKids: 'no', tags: [] }
    case 'wordpress':
      return { __type: 'wordpress', title: postTitle, type: 'post' }
    case 'gmb':
      return { __type: 'gmb', topicType: 'STANDARD' }
    case 'twitch':
      return { __type: 'twitch', messageType: 'message' }
    case 'mewe':
      return { __type: 'mewe', postType: 'timeline' }
    case 'kick':
    case 'threads':
    case 'mastodon':
    case 'bluesky':
    case 'telegram':
    case 'nostr':
    case 'vk':
      return { __type: provider }
    case 'wrapcast':
    case 'warpcast':
      return { __type: 'wrapcast', subreddit: [] }
    default:
      throw new Error(
        `Postiz provider "${provider}" needs extra settings that Slidesmith cannot infer yet, such as a board, channel, subreddit, list, group, or publication.`
      )
  }
}

export function buildPostizPayload({ integrationId, providerIdentifier, caption, media, title, date }) {
  if (!integrationId) throw new Error('Pick a Postiz integration in Settings.')
  if (!media?.length) throw new Error('No rendered slides to upload.')
  if (String(providerIdentifier || '').toLowerCase() === 'tiktok' && media.length > 35) {
    throw new Error('TikTok photo posts support at most 35 images.')
  }

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
        settings: providerSettings(providerIdentifier, title, caption),
      },
    ],
  }
}
