// Slideshow generation. Given the "Brain" (niche, audience, style memory,
// reference patterns), the chosen model writes N carousel slideshows: a hook,
// caption, hashtags, a rationale, and the per-slide text. Images are rendered
// later, client-side — the model only writes the words.
import { chatJSON } from './openrouter.js'
import { logger } from './log.js'

const log = logger('generate')

// Background gradients assigned per slide so rendering needs no image-gen API.
const PALETTE = [
  ['#0f172a', '#1e293b'],
  ['#1a1a2e', '#16213e'],
  ['#2d1b1b', '#1a1010'],
  ['#0a1f1c', '#0f2922'],
  ['#1f1147', '#160d33'],
  ['#26120a', '#1a0c06'],
]

function buildPrompt(brain, count) {
  return `You write native TikTok/Instagram carousel slideshows for a product-backed account.

Your job is NOT to write ads. Your job is to write useful, specific, save-worthy content
that the target audience would read even if they never install the product.

Account context:
- Niche: ${brain.niche || '(unspecified)'}
- App / brand: ${brain.appName || '(unspecified)'} — ${brain.appDescription || ''}
- Audience: ${brain.audience || '(unspecified)'}

What's working for this account (style memory — respect this closely):
${brain.styleMemory || '(none yet — use proven short-form patterns)'}

Core rules:
- Do not open with the product, brand, app name, or a generic benefit.
- Slide 1 must be a concrete pain, mistake, myth, warning, contradiction, or surprising observation.
- Make slide 1 specific enough that one audience segment feels called out.
- Each slideshow must focus on ONE narrow situation, not the whole product category.
- The first 80% should teach, explain, warn, or reframe. The product can appear only near the end as a soft helper.
- Avoid generic filler like "take control", "stay organized", "be productive", "plan better", "check the weather", "make life easier", unless made concrete.
- Avoid corporate marketing tone, feature lists, and hard CTAs.
- Write like a TikTok-native creator: short, plain, slightly opinionated, emotionally accurate.
- Every slideshow should be useful without the app, but naturally make the app feel relevant.
- Do not repeat the same angle across the batch.

Use varied angles across the batch:
- common mistake
- myth / misconception
- "why this happens"
- tiny fix
- checklist
- before / after
- contrarian take
- situation-specific warning
- one overlooked detail

Good hook examples by pattern, NOT to copy:
- "Your task list is why you procrastinate"
- "\\"Work on project\\" is not a task"
- "Don't dress for the high today"
- "Rain chance doesn't mean what you think"
- "The temperature is lying to you"
- "Your brain rejects vague tasks"

Write ${count} distinct slideshows. Respond with a JSON object of this exact shape:
{
  "slideshows": [
    {
      "hook": "slide 1 text — concrete, scroll-stopping, max 9 words",
      "slides": [
        "same hook again as slide 1",
        "specific mistake or tension",
        "why it happens",
        "tiny practical fix",
        "example or next step",
        "soft CTA / save-worthy closing"
      ],
      "caption": "short native caption, no hard sell, 0-1 emoji",
      "hashtags": ["three", "specific", "hashtags"],
      "rationale": "one sentence explaining the audience pain, angle, and why it should earn retention"
    }
  ]
}

Quality bar:
- If a slide could fit any app in any category, rewrite it.
- If the hook sounds like an ad headline, rewrite it.
- If the hook lacks a specific user situation, rewrite it.
- If the product mention appears before slide 5, rewrite it.

Return ONLY the JSON object.`
}

// Generate in small batches so big counts don't overflow the model's output /
// truncate the JSON. Each call asks for a handful; we loop until we hit `count`.
const BATCH = 6

export async function generateSlideshows({ apiKey, baseUrl, model, brain, count = 4 }) {
  log.start(`Generating ${count} slideshow${count === 1 ? '' : 's'} with ${model}`)
  if (brain?.niche) log.info(`niche: ${brain.niche}${brain.appName ? ` · ${brain.appName}` : ''}`)
  const raw = []
  let safety = 0
  while (raw.length < count && safety < count + 5) {
    safety++
    const n = Math.min(BATCH, count - raw.length)
    log.step(`asking model for ${n} more (${raw.length}/${count} so far)…`)
    const parsed = await chatJSON({ apiKey, baseUrl, model, prompt: buildPrompt(brain, n) })
    const batch = parsed.slideshows || []
    if (!batch.length) {
      log.warn('model returned no slideshows — stopping early')
      break // model returned nothing — stop rather than loop forever
    }
    raw.push(...batch)
    log.progress(Math.min(raw.length, count), count, 'written')
  }
  log.ok(`Generated ${Math.min(raw.length, count)} slideshow${raw.length === 1 ? '' : 's'}`)

  const stamp = Date.now()
  return raw.slice(0, count).map((s, i) => {
    const [from, to] = PALETTE[i % PALETTE.length]
    return {
      id: `q-${stamp}-${i}`,
      hook: s.hook || (s.slides && s.slides[0]) || '',
      caption: s.caption || '',
      hashtags: s.hashtags || [],
      rationale: s.rationale || '',
      createdAt: new Date(stamp).toISOString(),
      slides: (s.slides || []).map((text, j) => ({
        id: `slide-${stamp}-${i}-${j}`,
        text,
        bgFrom: from,
        bgTo: to,
      })),
    }
  })
}
