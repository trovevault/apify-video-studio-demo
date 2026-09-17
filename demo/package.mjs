// PACKAGE THE RENDERS FOR HANDOVER.
//
// The pre-render writes into the studio's own output tree, with absolute paths
// and slugged directory names. Neither travels: a path like
// /Users/luispinto/est-youtube/studio/demo/renders/... does not exist on anyone
// else's machine and means nothing to a web app.
//
// This copies the seven in here under their ids, with a manifest of RELATIVE
// paths, so the repo is the whole handover: drop `demo/renders` into a web app's
// public folder and the manifest already points at the right files.
//
// Run: node demo/package.mjs [path to studio/demo/renders]
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

const HERE = path.dirname(new URL(import.meta.url).pathname)
const src = process.argv[2] || path.join(os.homedir(), 'est-youtube', 'studio', 'demo', 'renders')
const dst = path.join(HERE, 'renders')

// THE DISK IS THE SOURCE OF TRUTH, NOT THE MANIFEST.
//
// Reading the prerender's manifest made this inherit any staleness in it, and a
// single-id prerender run once left that manifest holding one entry while seven
// videos sat on disk. So the render directories are scanned instead: a directory
// with a video in it exists, whatever any index claims.
const built = { results: fs.readdirSync(src, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => {
    const dir = path.join(src, e.name)
    const video = path.join(dir, 'final-vertical.mp4')
    if (!fs.existsSync(video)) return null
    let props = {}
    try { props = JSON.parse(fs.readFileSync(path.join(dir, 'props.json'), 'utf8')) } catch {}
    // The id is the leading `demo-N` of the slugged directory name.
    const id = (e.name.match(/^demo-\d+/) || [])[0]
    if (!id) return null
    const thumb = path.join(dir, 'thumb.png')
    return { id, ok: true, video, thumb: fs.existsSync(thumb) ? thumb : '',
      hook: props.hookVisual || '', style: props.style || '',
      script: readScript(dir), seconds: durationOf(video) }
  })
  .filter(Boolean)
  .sort((a, b) => Number(a.id.slice(5)) - Number(b.id.slice(5))) }

function readScript(dir) {
  try { return fs.readFileSync(path.join(dir, 'vo.txt'), 'utf8').trim() } catch { return '' }
}
function durationOf(f) {
  try {
    const { execFileSync } = require('node:child_process')
    return +parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' })).toFixed(2)
  } catch { return 0 }
}
const ideas = JSON.parse(fs.readFileSync(path.join(HERE, 'ideas.json'), 'utf8'))
const stages = JSON.parse(fs.readFileSync(path.join(HERE, 'stages.json'), 'utf8'))
const byId = Object.fromEntries(ideas.ideas.map((i) => [i.id, i]))

fs.rmSync(dst, { recursive: true, force: true })
fs.mkdirSync(dst, { recursive: true })

const out = []
for (const r of built.results) {
  if (!r.ok) { console.log(`  skipped ${r.id}: ${r.error}`); continue }
  const idea = byId[r.id]
  fs.mkdirSync(path.join(dst, r.id), { recursive: true })
  const copy = (from, name) => {
    if (!from || !fs.existsSync(from)) return null
    fs.copyFileSync(from, path.join(dst, r.id, name))
    return `renders/${r.id}/${name}`
  }
  const video = copy(r.video, 'video.mp4')
  const thumb = copy(r.thumb, 'thumb.png')
  const bytes = video ? fs.statSync(path.join(dst, r.id, 'video.mp4')).size : 0
  out.push({
    id: r.id, title: idea ? idea.title : r.id, keyword: idea ? idea.keyword : '',
    video, thumb, bytes, seconds: r.seconds, hook: r.hook, style: r.style,
    // The spoken words, so a caller can show captions or a transcript without
    // re-deriving anything, and so the figures on screen can be checked against
    // the subject that produced them.
    script: r.script,
    verified: idea ? idea.verified : null,
  })
}

const manifest = { packagedAt: new Date().toISOString(), stages: stages.stages, videos: out }
fs.writeFileSync(path.join(dst, 'manifest.json'), JSON.stringify(manifest, null, 1))
const mb = out.reduce((n, v) => n + v.bytes, 0) / 1048576
console.log(`\npackaged ${out.length} video(s), ${mb.toFixed(1)} MB, into demo/renders/`)
out.forEach((v) => console.log(`  ${v.id}  ${(v.bytes / 1048576).toFixed(1)} MB  ${v.seconds.toFixed(1)}s  ${v.hook}  ${v.title}`))
