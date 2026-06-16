// OpenAI-compatible AI client. OpenRouter is still the default, but users can
// point this at DeepSeek or another compatible /chat/completions endpoint.
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

// Recommended (optional) attribution headers for OpenRouter.
const ATTRIBUTION = {
  'HTTP-Referer': 'https://github.com/slidesmith',
  'X-Title': 'Slidesmith',
}

// Public — no key required. Returns the full catalog so the UI can list models.
export async function listModels() {
  const res = await fetch(`${OPENROUTER_BASE}/models`)
  if (!res.ok) throw new Error(`OpenRouter models ${res.status}`)
  const body = await res.json()
  return (body?.data || [])
    .map((m) => ({ id: m.id, name: m.name || m.id }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || OPENROUTER_BASE).replace(/\/+$/, '')
}

function providerName(baseUrl) {
  const base = normalizeBaseUrl(baseUrl)
  if (base.includes('openrouter.ai')) return 'OpenRouter'
  if (base.includes('deepseek.com')) return 'DeepSeek'
  return 'AI provider'
}

// Validate a key. OpenRouter has a no-spend /key endpoint; other compatible
// providers usually expose /models, which is still cheaper than a completion.
export async function validateKey(apiKey, baseUrl) {
  if (!apiKey) throw new Error('Missing AI API key. Add it in Settings.')
  const base = normalizeBaseUrl(baseUrl)
  const name = providerName(base)
  const path = base.includes('openrouter.ai') ? '/key' : '/models'
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`${name} ${res.status}: invalid key or base URL`)
  return true
}

// Pull a JSON object out of a model response, tolerating code fences / prose.
function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('Model did not return JSON.')
  return JSON.parse(candidate.slice(start, end + 1))
}

// One chat completion that must return a JSON object.
export async function chatJSON({ apiKey, baseUrl, model, prompt }) {
  if (!apiKey) throw new Error('Missing AI API key. Add it in Settings.')
  if (!model) throw new Error('No model selected. Pick one in Settings.')

  const base = normalizeBaseUrl(baseUrl)
  const name = providerName(base)
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      ...ATTRIBUTION,
    },
    body: JSON.stringify({
      model,
      max_tokens: 6000,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(`${name} ${res.status}: ${body?.error?.message || res.statusText}`)
  }
  const content = body?.choices?.[0]?.message?.content
  if (!content) throw new Error(`${name} returned no content.`)
  return extractJson(content)
}
