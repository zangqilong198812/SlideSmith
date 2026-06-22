// Local, file-based persistence. Slidesmith is a single-user tool, so all state
// lives in a small JSON config file + a queue file under the user's home dir.
// No database — post-bridge holds the scheduled posts and results.
//
// A "project" is one brand/account you generate for. Only the Brain and the
// default post-bridge accounts differ per project; the API keys and model are
// global. The queue (generated-but-unscheduled drafts) is per project.
import { homedir } from 'node:os'
import { join, extname } from 'node:path'
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs'
import { bundledPackNames } from './library.js'

const DIR = process.env.SLIDESMITH_DIR || join(homedir(), '.slidesmith')
const CONFIG_PATH = join(DIR, 'config.json')
const QUEUE_PATH = join(DIR, 'queue.json')
const FINAL_SLIDES_DIR = join(DIR, 'final-slides')

const DEFAULT_BRAIN = {
  niche: '',
  appName: '',
  appDescription: '',
  audience: '',
  styleMemory: '',
}
const DEFAULT_DEFAULTS = { socialAccountIds: [], mode: 'draft', postizIntegrationId: '' }
const DEFAULT_AI_BASE_URL = 'https://openrouter.ai/api/v1'
const DEFAULT_POSTIZ_BASE_URL = 'https://api.postiz.com/public/v1'

function ensureDir() {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })
}
function ensureFinalSlidesDir() {
  ensureDir()
  if (!existsSync(FINAL_SLIDES_DIR)) mkdirSync(FINAL_SLIDES_DIR, { recursive: true })
}
function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}
function writeJson(path, value) {
  ensureDir()
  writeFileSync(path, JSON.stringify(value, null, 2))
}
function newId(prefix) {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}`
}
function normalizeFinalSlideUrls(project = {}) {
  const urls = Array.isArray(project.finalSlideImageUrls) ? project.finalSlideImageUrls.filter(Boolean) : []
  if (project.finalSlideImageUrl && !urls.includes(project.finalSlideImageUrl)) urls.unshift(project.finalSlideImageUrl)
  return urls
}

function makeProject(name, brain, defaults, imagePacks, finalSlideImageUrls) {
  const urls = Array.isArray(finalSlideImageUrls) ? finalSlideImageUrls.filter(Boolean) : []
  return {
    id: newId('p'),
    name: name || 'Project 1',
    brain: { ...DEFAULT_BRAIN, ...brain },
    defaults: { ...DEFAULT_DEFAULTS, ...defaults },
    // Which background packs generation draws from. Defaults to all bundled
    // packs so a fresh project generates with images out of the box. Empty = gradients.
    imagePacks: imagePacks ?? bundledPackNames(),
    finalSlideImageUrl: urls[0] || '',
    finalSlideImageUrls: urls,
  }
}

// Normalize on every read: fill defaults and migrate the old single-brain shape
// ({ brain, defaults } at top level) into projects[].
export function getConfig() {
  const s = readJson(CONFIG_PATH, {})
  let projects = Array.isArray(s.projects) && s.projects.length
    ? s.projects.map((p) => ({
        id: p.id || newId('p'),
        name: p.name || 'Project',
        brain: { ...DEFAULT_BRAIN, ...p.brain },
        defaults: { ...DEFAULT_DEFAULTS, ...p.defaults },
        imagePacks: p.imagePacks ?? bundledPackNames(),
        finalSlideImageUrl: normalizeFinalSlideUrls(p)[0] || '',
        finalSlideImageUrls: normalizeFinalSlideUrls(p),
      }))
    : null

  if (!projects) {
    // Migrate a pre-projects config, or create the first project.
    const p = makeProject(s.brain?.appName || 'Project 1', s.brain, s.defaults)
    projects = [p]
  }

  const activeProjectId = projects.some((p) => p.id === s.activeProjectId)
    ? s.activeProjectId
    : projects[0].id

  const cfg = {
    keys: { postbridge: '', openrouter: '', apify: '', postiz: '', ...s.keys },
    aiBaseUrl: s.aiBaseUrl || DEFAULT_AI_BASE_URL,
    postizBaseUrl: s.postizBaseUrl || DEFAULT_POSTIZ_BASE_URL,
    model: s.model || 'openai/gpt-4o-mini',
    pinterestActor: s.pinterestActor || 'fatihtahta/pinterest-scraper-search',
    projects,
    activeProjectId,
  }

  // If we had to synthesize/migrate projects (no valid persisted projects array,
  // or the active id was stale), write it back once so project ids are stable
  // across subsequent reads. Otherwise every read would mint fresh ids.
  const needsPersist =
    !Array.isArray(s.projects) ||
    s.projects.length !== projects.length ||
    s.activeProjectId !== activeProjectId ||
    s.projects.some((p, i) => p.id !== projects[i].id)
  if (needsPersist) writeJson(CONFIG_PATH, cfg)

  return cfg
}

function writeConfig(cfg) {
  writeJson(CONFIG_PATH, cfg)
  return cfg
}

// Global settings only (keys + model). Project data is edited via the project ops.
export function saveGlobal(patch) {
  const c = getConfig()
  return writeConfig({
    ...c,
    aiBaseUrl: patch.aiBaseUrl ?? c.aiBaseUrl,
    postizBaseUrl: patch.postizBaseUrl ?? c.postizBaseUrl,
    model: patch.model ?? c.model,
    pinterestActor: patch.pinterestActor ?? c.pinterestActor,
    keys: { ...c.keys, ...patch.keys },
  })
}

export function getActiveProject(c = getConfig()) {
  return c.projects.find((p) => p.id === c.activeProjectId) || c.projects[0]
}

export function createProject(name) {
  const c = getConfig()
  const project = makeProject(name || `Project ${c.projects.length + 1}`)
  return writeConfig({ ...c, projects: [...c.projects, project], activeProjectId: project.id })
}

export function updateProject(id, patch) {
  const c = getConfig()
  const projects = c.projects.map((p) =>
    p.id === id
      ? {
          ...p,
          name: patch.name ?? p.name,
          brain: patch.brain ? { ...p.brain, ...patch.brain } : p.brain,
          defaults: patch.defaults ? { ...p.defaults, ...patch.defaults } : p.defaults,
          imagePacks: patch.imagePacks ?? p.imagePacks,
          finalSlideImageUrls: patch.finalSlideImageUrls !== undefined ? patch.finalSlideImageUrls : p.finalSlideImageUrls,
          finalSlideImageUrl: patch.finalSlideImageUrls !== undefined
            ? (patch.finalSlideImageUrls[0] || '')
            : (patch.finalSlideImageUrl !== undefined ? patch.finalSlideImageUrl : p.finalSlideImageUrl),
        }
      : p
  )
  return writeConfig({ ...c, projects })
}

function finalSlidePath(projectId, imageId = 'default', ext = '.png') {
  return join(FINAL_SLIDES_DIR, `${projectId}-${imageId}${ext}`)
}

function legacyFinalSlidePath(projectId, ext = '.png') {
  return join(FINAL_SLIDES_DIR, `${projectId}${ext}`)
}

function removeExistingFinalSlide(projectId) {
  ensureFinalSlidesDir()
  for (const name of readdirSync(FINAL_SLIDES_DIR)) {
    if (name.startsWith(`${projectId}-`)) rmSync(join(FINAL_SLIDES_DIR, name), { force: true })
  }
  for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
    const path = legacyFinalSlidePath(projectId, ext)
    if (existsSync(path)) rmSync(path, { force: true })
  }
}

function decodeFinalSlide(dataUrl) {
  const match = String(dataUrl || '').match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/)
  if (!match) throw new Error('Upload a PNG, JPG, or WEBP image.')
  const ext = match[1] === 'jpeg' ? '.jpg' : `.${match[1]}`
  const buffer = Buffer.from(match[2], 'base64')
  if (!buffer.length) throw new Error('Uploaded image is empty.')
  if (buffer.length > 15 * 1024 * 1024) throw new Error('Final slide image must be under 15 MB.')
  return { ext, buffer }
}

export function saveFinalSlide(projectId, dataUrlOrUrls) {
  const dataUrls = Array.isArray(dataUrlOrUrls) ? dataUrlOrUrls : [dataUrlOrUrls]
  if (!dataUrls.length) throw new Error('Upload at least one final slide image.')

  ensureFinalSlidesDir()
  const project = getConfig().projects.find((p) => p.id === projectId)
  const existing = project?.finalSlideImageUrls || normalizeFinalSlideUrls(project)
  const version = Date.now()
  const added = dataUrls.map((dataUrl) => {
    const { ext, buffer } = decodeFinalSlide(dataUrl)
    const imageId = newId('final')
    writeFileSync(finalSlidePath(projectId, imageId, ext), buffer)
    return `/api/final-slide/${encodeURIComponent(projectId)}/${encodeURIComponent(imageId)}?v=${version}`
  })
  return updateProject(projectId, { finalSlideImageUrls: [...existing, ...added] })
}

function fileFromFinalSlideUrl(projectId, imageUrl) {
  const match = String(imageUrl || '').match(new RegExp(`/api/final-slide/${projectId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/([^?/#]+)`))
  if (!match) return null
  const imageId = decodeURIComponent(match[1])
  for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
    const path = finalSlidePath(projectId, imageId, ext)
    if (existsSync(path)) return path
  }
  return null
}

export function clearFinalSlide(projectId, imageUrl = '') {
  if (!imageUrl) {
    removeExistingFinalSlide(projectId)
    return updateProject(projectId, { finalSlideImageUrls: [] })
  }
  const path = fileFromFinalSlideUrl(projectId, imageUrl)
  if (path) rmSync(path, { force: true })
  const project = getConfig().projects.find((p) => p.id === projectId)
  const urls = normalizeFinalSlideUrls(project).filter((url) => url !== imageUrl)
  return updateProject(projectId, { finalSlideImageUrls: urls })
}

export function getFinalSlideFile(projectId, imageId = '') {
  if (imageId) {
    for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
      const path = finalSlidePath(projectId, imageId, ext)
      if (existsSync(path)) return { path, ext: extname(path).toLowerCase() }
    }
    return null
  }
  for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
    const path = legacyFinalSlidePath(projectId, ext)
    if (existsSync(path)) return { path, ext: extname(path).toLowerCase() }
  }
  return null
}

export function deleteProject(id) {
  const c = getConfig()
  let projects = c.projects.filter((p) => p.id !== id)
  if (!projects.length) projects = [makeProject('Project 1')]
  const activeProjectId = c.activeProjectId === id ? projects[0].id : c.activeProjectId
  removeQueueFor(id)
  removeExistingFinalSlide(id)
  return writeConfig({ ...c, projects, activeProjectId })
}

export function setActiveProject(id) {
  const c = getConfig()
  if (!c.projects.some((p) => p.id === id)) throw new Error('Unknown project')
  return writeConfig({ ...c, activeProjectId: id })
}

// ── Queue (per project) ───────────────────────────────────────────────────────
function readQueueMap() {
  const m = readJson(QUEUE_PATH, {})
  return m && !Array.isArray(m) ? m : {}
}
function writeQueueMap(m) {
  writeJson(QUEUE_PATH, m)
  return m
}
export function getQueue(projectId) {
  return readQueueMap()[projectId] || []
}
export function setQueue(projectId, items) {
  const m = readQueueMap()
  m[projectId] = items
  writeQueueMap(m)
  return items
}
export function addToQueue(projectId, items) {
  return setQueue(projectId, [...items, ...getQueue(projectId)])
}
export function removeFromQueue(projectId, id) {
  return setQueue(projectId, getQueue(projectId).filter((s) => s.id !== id))
}
function removeQueueFor(projectId) {
  const m = readQueueMap()
  delete m[projectId]
  writeQueueMap(m)
}

export const CONFIG_DIR = DIR
