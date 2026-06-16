// Local, file-based persistence. Slidesmith is a single-user tool, so all state
// lives in a small JSON config file + a queue file under the user's home dir.
// No database — post-bridge holds the scheduled posts and results.
//
// A "project" is one brand/account you generate for. Only the Brain and the
// default post-bridge accounts differ per project; the API keys and model are
// global. The queue (generated-but-unscheduled drafts) is per project.
import { homedir } from 'node:os'
import { join, extname } from 'node:path'
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
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
const DEFAULT_DEFAULTS = { socialAccountIds: [], mode: 'draft' }
const DEFAULT_AI_BASE_URL = 'https://openrouter.ai/api/v1'

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
function makeProject(name, brain, defaults, imagePacks, finalSlideImageUrl) {
  return {
    id: newId('p'),
    name: name || 'Project 1',
    brain: { ...DEFAULT_BRAIN, ...brain },
    defaults: { ...DEFAULT_DEFAULTS, ...defaults },
    // Which background packs generation draws from. Defaults to all bundled
    // packs so a fresh project generates with images out of the box. Empty = gradients.
    imagePacks: imagePacks ?? bundledPackNames(),
    finalSlideImageUrl,
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
        finalSlideImageUrl: p.finalSlideImageUrl,
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
    keys: { postbridge: '', openrouter: '', apify: '', ...s.keys },
    aiBaseUrl: s.aiBaseUrl || DEFAULT_AI_BASE_URL,
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
          finalSlideImageUrl: patch.finalSlideImageUrl !== undefined ? patch.finalSlideImageUrl : p.finalSlideImageUrl,
        }
      : p
  )
  return writeConfig({ ...c, projects })
}

function finalSlidePath(projectId, ext = '.png') {
  return join(FINAL_SLIDES_DIR, `${projectId}${ext}`)
}

function removeExistingFinalSlide(projectId) {
  for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
    const path = finalSlidePath(projectId, ext)
    if (existsSync(path)) rmSync(path)
  }
}

export function saveFinalSlide(projectId, dataUrl) {
  const match = String(dataUrl || '').match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/)
  if (!match) throw new Error('Upload a PNG, JPG, or WEBP image.')
  const ext = match[1] === 'jpeg' ? '.jpg' : `.${match[1]}`
  const buffer = Buffer.from(match[2], 'base64')
  if (!buffer.length) throw new Error('Uploaded image is empty.')
  if (buffer.length > 15 * 1024 * 1024) throw new Error('Final slide image must be under 15 MB.')

  ensureFinalSlidesDir()
  removeExistingFinalSlide(projectId)
  writeFileSync(finalSlidePath(projectId, ext), buffer)
  const version = Date.now()
  return updateProject(projectId, { finalSlideImageUrl: `/api/final-slide/${encodeURIComponent(projectId)}?v=${version}` })
}

export function clearFinalSlide(projectId) {
  removeExistingFinalSlide(projectId)
  return updateProject(projectId, { finalSlideImageUrl: '' })
}

export function getFinalSlideFile(projectId) {
  for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
    const path = finalSlidePath(projectId, ext)
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
