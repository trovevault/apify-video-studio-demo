// DEMO MODE. NOT THE REAL PIPELINE.
//
// This exists for one live presentation. It serves seven fixed, vetted subjects
// instead of generated ideas, and it plays back a video that was rendered
// earlier from that subject's real scrape.
//
// WHAT IS REAL HERE AND WHAT IS NOT
//
// Real: the subjects, the scrapes behind them, the scripts, and every figure on
// screen in every video. These videos came out of the same pipeline the app
// uses, from the same cached runs, and nothing was overlaid or substituted
// afterwards. A pre-rendered video is faster, not different.
//
// Not real: the clock. The stages below advance on a timer rather than because
// work is finishing, because a 190-second render does not fit on a stage. The
// operator knows this; nothing in the output depends on it.
//
// Guarded by CFG.DEMO so it cannot be reached by accident. Every entry point
// returns null when the mode is off.
import fs from 'node:fs'
import path from 'node:path'
import { CFG } from '../electron/config.js'
import { fileURLToPath } from 'node:url'

// `ideas.json` and `stages.json` sit beside this file and are small, so they ship
// inside the app. The renders do not: they are resolved through CFG, which points
// outside the bundle.
// `fileURLToPath`, not `new URL(...).pathname`. The pathname keeps percent
// escapes, so a space in a directory arrives as %20 and every read fails. It
// looked fine everywhere until this shipped inside
// /Applications/Apify Video Studio Demo.app/ and the ideas file stopped loading.
const HERE = path.dirname(fileURLToPath(import.meta.url))
const load = (f) => { try { return JSON.parse(fs.readFileSync(path.join(HERE, f), 'utf8')) } catch { return null } }
const RENDERS = () => {
  try { return CFG.DEMO_RENDERS } catch { return path.join(HERE, 'renders') }
}

export function demoConfig() { return load('ideas.json') }
export function demoManifest() {
  try { return JSON.parse(fs.readFileSync(path.join(RENDERS(), 'manifest.json'), 'utf8')) } catch { return null }
}

// The seven, in the shape the ideas store uses, so they render in the UI exactly
// like generated ones.
export function demoIdeas() {
  const cfg = demoConfig()
  if (!cfg) return []
  return cfg.ideas.map((i, n) => ({
    id: i.id, ts: Date.now() - (cfg.ideas.length - n) * 60000, status: 'pending', kind: 'short',
    title: i.title, keyword: i.keyword, category: i.category, format: i.format,
    brief: i.brief, demo: true,
  }))
}

// Which pre-rendered file belongs to an idea, or null if it was never built.
export function demoRender(ideaId) {
  const m = demoManifest()
  if (!m) return null
  // Two manifest shapes exist and both are legitimate: the studio's raw output
  // records absolute paths, the packaged handover records paths relative to the
  // renders folder. Resolve against that folder and either one works.
  const rows = m.videos || m.results || []
  const hit = rows.find((r) => r.id === ideaId && r.video)
  if (!hit) return null
  // `file` is the disk path relative to the manifest; `video` is the web path and
  // is NOT usable here, because it carries the serving prefix. Absolute paths are
  // the studio's own output tree.
  const rel = hit.file || (path.isAbsolute(hit.video) ? hit.video : null)
  if (!rel) return null
  const video = path.isAbsolute(rel) ? rel : path.join(RENDERS(), rel)
  if (!fs.existsSync(video)) return null
  const t = hit.thumbFile || (hit.thumb && path.isAbsolute(hit.thumb) ? hit.thumb : null)
  const thumb = t ? (path.isAbsolute(t) ? t : path.join(RENDERS(), t)) : ''
  return { ...hit, video, thumb: thumb && fs.existsSync(thumb) ? thumb : '' }
}

// THE STAGE WALK.
//
// Read from stages.json rather than written here, because the same list drives
// the web app this is handed to. One file, one wording, one set of timings: if
// they drift, the two demos stop looking like the same product.
export const DEMO_STAGES = (() => {
  const s = load('stages.json')
  return (s && s.stages) || []
})()

// Walk the stages, then hand back the pre-rendered artefact. `emit` is the same
// progress channel the real job uses, so the UI needs no special case.
export async function demoReplay(ideaId, emit, { cancelled = () => false } = {}) {
  const hit = demoRender(ideaId)
  if (!hit) throw new Error(`no pre-rendered video for ${ideaId}. Run: node demo/prerender.mjs ${ideaId}`)
  for (const s of DEMO_STAGES) {
    if (cancelled()) return null
    emit({ status: 'running', stage: s.key, activity: s.label, pct: s.pct })
    await new Promise((r) => setTimeout(r, s.hold))
  }
  if (cancelled()) return null
  emit({
    status: 'done', stage: 'done', activity: 'Done', done: true, pct: 100,
    videoPath: hit.video, thumbPath: hit.thumb || '', outDir: path.dirname(hit.video),
    keyword: ideaId, source: 'Short', orientation: 'vertical',
    meta: { mode: 'short', engine: 'remotion', seconds: hit.seconds, hook: hit.hook, style: hit.style, demo: true },
  })
  return hit
}

// How long the idea generator should appear to think before handing the seven
// back. Instant ideas read as ideas that were already sitting there.
export function demoIdeasDelay() {
  const s = load('stages.json')
  return (s && Number(s.ideasDelayMs)) || 5500
}

export function demoTotalSeconds() {
  return DEMO_STAGES.reduce((n, s) => n + s.hold, 0) / 1000
}
