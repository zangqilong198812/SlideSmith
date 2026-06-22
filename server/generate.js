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

function buildClassicPrompt(brain, count) {
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

function buildNotesPrompt(brain, count) {
  return `You write native TikTok/Instagram carousel slideshows in a "human photo + Notes screenshot" style.

This style is inspired by creator-growth carousel accounts where slide 1 feels like a personal post,
then the next slides look like a Notes app screenshot with practical lessons. The result must feel
creator-native, not like an app advertisement.

Account context:
- Niche: ${brain.niche || '(unspecified)'}
- App / brand: ${brain.appName || '(unspecified)'} — ${brain.appDescription || ''}
- Audience: ${brain.audience || '(unspecified)'}

What's working for this account (style memory — respect this closely):
${brain.styleMemory || '(none yet — use proven short-form patterns)'}

Core rules:
- Slide 1 is a first-person hook over a human/lifestyle background. It should sound like lived experience.
- Slide 1 must NOT mention the product, brand, app name, or a generic benefit.
- Use hooks like: "i stopped...", "after 3 months...", "i finally realized...", "this fixed...", "i was doing this wrong..."
- Notes slides should read like a screenshot from someone's Notes app: short title, blank lines, numbered or dashed observations.
- The notes must teach something useful even if the reader never installs the app.
- Mention the app only near the end, as a soft helper or optional system. No hard CTA.
- Keep the whole slideshow narrow: one concrete situation, mistake, or realization.
- Avoid polished marketing language, feature lists, and generic motivational advice.
- Do not repeat the same angle across the batch.

Good hook patterns by category, NOT to copy:
- productivity: "i stopped rewriting my todo list every night"
- productivity: "my tasks were vague, not hard"
- weather: "i stopped dressing for the high temperature"
- weather: "rain chance was tricking me"
- creator tools: "i finally got out of 300 views jail"

Write ${count} distinct slideshows. Respond with a JSON object of this exact shape:
{
  "slideshows": [
    {
      "hook": "same as slide 1, lowercase first-person, max 11 words",
      "slides": [
        {
          "layout": "classic",
          "text": "same hook again as slide 1"
        },
        {
          "layout": "notes",
          "text": "notes title\\n\\n1. specific lesson\\n2. specific lesson\\n3. specific lesson"
        },
        {
          "layout": "notes",
          "text": "what changed\\n\\n- concrete before\\n- concrete after\\n- soft app mention only if natural"
        }
      ],
      "caption": "short native caption, first-person or conversational, no hard sell, 0-1 emoji",
      "hashtags": ["three", "specific", "hashtags"],
      "rationale": "one sentence explaining the audience pain, angle, and why the notes format should earn retention"
    }
  ]
}

Quality bar:
- If slide 1 sounds like an ad headline, rewrite it.
- If the notes could fit any app in any category, rewrite them.
- If the product appears before the final notes slide, rewrite it.
- If a note line is longer than 11 words, shorten it.

Return ONLY the JSON object.`
}

function buildShowcasePrompt(brain, count) {
  return `You write native TikTok/Instagram carousel slideshows in a polished "device setup showcase" style.

The visual template will show a blurred full-screen background, a centered phone/product screenshot,
a bold title at the top, and one short explanatory line near the bottom. Your job is to write
short labels that make each slide feel like a useful walkthrough, not an ad.

Account context:
- Niche: ${brain.niche || '(unspecified)'}
- App / brand: ${brain.appName || '(unspecified)'} — ${brain.appDescription || ''}
- Audience: ${brain.audience || '(unspecified)'}

What's working for this account (style memory — respect this closely):
${brain.styleMemory || '(none yet — use proven short-form patterns)'}

Core rules:
- Each slideshow should feel like "my setup", "how I organize this", or "the feature I actually use".
- Slide titles must be concrete UI/location labels: "Today View", "Lock Screen Widget", "Home Screen Setup", "Quick Capture", "Calendar Button".
- Keep each title under 5 words.
- The second line should be one simple benefit or observation, max 14 words.
- Use practical creator-native wording, not marketing language.
- Mention the app only when it feels like a natural label or soft helper.
- Do not repeat the same feature across the batch.

Write ${count} distinct slideshows. Respond with a JSON object of this exact shape:
{
  "slideshows": [
    {
      "hook": "short setup-style hook, max 8 words",
      "slides": [
        {
          "layout": "showcase",
          "text": "Top Title\\nshort bottom line"
        },
        {
          "layout": "showcase",
          "text": "Second Screen\\nshort bottom line"
        },
        {
          "layout": "showcase",
          "text": "Follow For More\\nshort CTA line"
        }
      ],
      "caption": "short native caption, no hard sell, 0-1 emoji",
      "hashtags": ["three", "specific", "hashtags"],
      "rationale": "one sentence explaining the setup angle and why it should earn retention"
    }
  ]
}

Quality bar:
- If a title sounds like an ad benefit, rewrite it as a UI/location label.
- If a line is longer than 14 words, shorten it.
- If the slideshow could fit any app without changing a word, rewrite it.

Return ONLY the JSON object.`
}

function buildPrompt(brain, count, style) {
  if (style === 'notes') return buildNotesPrompt(brain, count)
  if (style === 'showcase') return buildShowcasePrompt(brain, count)
  return buildClassicPrompt(brain, count)
}

// Generate in small batches so big counts don't overflow the model's output /
// truncate the JSON. Each call asks for a handful; we loop until we hit `count`.
const BATCH = 6

function normalizeSlide(rawSlide, fallbackLayout = 'classic') {
  if (typeof rawSlide === 'string') {
    return { text: rawSlide, layout: fallbackLayout }
  }
  return {
    text: String(rawSlide?.text || ''),
    layout: rawSlide?.layout === 'notes' || rawSlide?.layout === 'showcase' ? rawSlide.layout : fallbackLayout,
  }
}

export async function generateSlideshows({ apiKey, baseUrl, model, brain, count = 4, style = 'classic' }) {
  log.start(`Generating ${count} ${style} slideshow${count === 1 ? '' : 's'} with ${model}`)
  if (brain?.niche) log.info(`niche: ${brain.niche}${brain.appName ? ` · ${brain.appName}` : ''}`)
  const raw = []
  let safety = 0
  while (raw.length < count && safety < count + 5) {
    safety++
    const n = Math.min(BATCH, count - raw.length)
    log.step(`asking model for ${n} more (${raw.length}/${count} so far)…`)
    const parsed = await chatJSON({ apiKey, baseUrl, model, prompt: buildPrompt(brain, n, style) })
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
    const firstSlide = normalizeSlide(s.slides?.[0] || '', 'classic')
    return {
      id: `q-${stamp}-${i}`,
      hook: s.hook || firstSlide.text || '',
      caption: s.caption || '',
      hashtags: s.hashtags || [],
      rationale: s.rationale || '',
      createdAt: new Date(stamp).toISOString(),
      slides: (s.slides || []).map((rawSlide, j) => {
        const slide = normalizeSlide(rawSlide, style === 'notes' && j > 0 ? 'notes' : style === 'showcase' ? 'showcase' : 'classic')
        return {
          id: `slide-${stamp}-${i}-${j}`,
          text: slide.text,
          layout: slide.layout,
          bgFrom: from,
          bgTo: to,
        }
      }),
    }
  })
}
