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

const HERE = path.dirname(new URL(import.meta.url).pathname)
const load = (f) => { try { return JSON.parse(fs.readFileSync(path.join(HERE, f), 'utf8')) } catch { return null } }

export function demoConfig() { return load('ideas.json') }
export function demoManifest() { return load(path.join('renders', 'manifest.json')) }

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
  const hit = m && m.results.find((r) => r.id === ideaId && r.ok)
  if (!hit || !hit.video || !fs.existsSync(hit.video)) return null
  return hit
}

// THE STAGE WALK.
//
// Named after the stages the real job emits, in the real order, so the operator
// narrates the same thing either way. `hold` is how long each is shown.
export const DEMO_STAGES = [
  { stage: 'ingest', activity: 'Running the Apify Actor', pct: 6, hold: 6000 },
  { stage: 'ingest', activity: 'Dropping accessories and duplicates', pct: 18, hold: 5000 },
  { stage: 'script', activity: 'Writing the script from those numbers', pct: 32, hold: 7000 },
  { stage: 'voice', activity: 'Narrating in your voice', pct: 52, hold: 7000 },
  { stage: 'visuals', activity: 'Rendering 1080x1920', pct: 78, hold: 6000 },
  { stage: 'editor', activity: 'Mixing and colour correcting', pct: 94, hold: 5000 },
]

// Walk the stages, then hand back the pre-rendered artefact. `emit` is the same
// progress channel the real job uses, so the UI needs no special case.
export async function demoReplay(ideaId, emit, { cancelled = () => false } = {}) {
  const hit = demoRender(ideaId)
  if (!hit) throw new Error(`no pre-rendered video for ${ideaId}. Run: node demo/prerender.mjs ${ideaId}`)
  for (const s of DEMO_STAGES) {
    if (cancelled()) return null
    emit({ status: 'running', stage: s.stage, activity: s.activity, pct: s.pct })
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

export function demoTotalSeconds() {
  return DEMO_STAGES.reduce((n, s) => n + s.hold, 0) / 1000
}
