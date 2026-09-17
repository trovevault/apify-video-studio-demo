// PRE-RENDER THE SEVEN DEMO SUBJECTS.
//
// Every video is made by the real pipeline from the real cached scrape for that
// subject, so what is on screen is what the run returned. Nothing is overlaid
// afterwards and no number is substituted: a pre-rendered video is only faster,
// it is not different.
//
// Run: node demo/prerender.mjs [id ...]
import fs from 'node:fs'
import path from 'node:path'

const S = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const { subjectFrom } = await import(`${S}/electron/videoData.js`)
const { planApproved } = await import(`${S}/electron/approveQueue.js`)
const { planShortV1 } = await import(`${S}/electron/shortPipeline.js`)
const { writeScripts } = await import(`${S}/electron/scriptAgent.js`)
const { runJob } = await import(`${S}/electron/orchestrator.js`)
const { CFG } = await import(`${S}/electron/config.js`)

const cfg = JSON.parse(fs.readFileSync(`${S}/demo/ideas.json`, 'utf8'))
const cache = JSON.parse(fs.readFileSync(`${S}/.ingest-cache.json`, 'utf8'))
const only = process.argv.slice(2)
const ideas = only.length ? cfg.ideas.filter((i) => only.includes(i.id)) : cfg.ideas
const outRoot = path.join(S, 'demo', 'renders')
fs.mkdirSync(outRoot, { recursive: true })

const results = []
for (const idea of ideas) {
  const t0 = Date.now()
  process.stdout.write(`\n=== ${idea.id}  ${idea.keyword}\n`)
  try {
    const hit = Object.entries(cache).find(([k]) => k.startsWith(idea.cacheKey))
    if (!hit) throw new Error(`cache key ${idea.cacheKey} is gone`)
    const subject = await subjectFrom(idea.keyword, { items: hit[1].data.items || [], currency: '$' })
    // The verified figures in ideas.json are a contract: if the pipeline stops
    // agreeing with them the subject is no longer the one that was vetted, and a
    // live demo is the worst place to find that out.
    if (subject.products.length !== idea.verified.products) {
      process.stdout.write(`  ! ${subject.products.length} products now, ${idea.verified.products} when vetted\n`)
    }

    const queued = []
    const r = await planApproved(
      { ideas: [{ ...idea, status: 'approved', kind: 'short' }] },
      {
        fetchSubject: async () => subject,
        planShortV1,
        writeScripts,
        planShort: async () => { throw new Error('should not reach the storyboard planner') },
        planEpisode: async () => { throw new Error('not long-form') },
        outroShots: () => [],
        pickMusic: () => path.join(CFG.MUSIC, 'Low Tension (reveal).mp3'),
        enqueue: (j) => queued.push(j),
        setStatus: () => {},
        failIdea: (_id, why) => { throw new Error(why) },
        log: { info: () => {} },
      },
    )
    if (!r.ok || !queued.length) throw new Error(`nothing queued: ${JSON.stringify(r.results)}`)

    const input = { ...queued[0], outputDir: outRoot }
    const job = { id: idea.id, input, cancelled: false, children: new Set() }
    let done = null
    await runJob({ job, queue: { acquireStage: async () => {}, releaseStage: () => {} },
      emit: (e) => { if (e.done) done = e } })
    if (!done) throw new Error('no done event')

    const secs = (Date.now() - t0) / 1000
    results.push({ id: idea.id, ok: true, video: done.videoPath, thumb: done.thumbPath,
      script: input.script, hook: input.props.hookVisual, style: input.props.style,
      seconds: done.meta.seconds, builtIn: +secs.toFixed(1) })
    process.stdout.write(`  done in ${secs.toFixed(0)}s  ${done.meta.seconds}s of video  hook=${input.props.hookVisual}\n`)
  } catch (e) {
    results.push({ id: idea.id, ok: false, error: String(e.message || e).slice(0, 180) })
    process.stdout.write(`  FAILED  ${String(e.message || e).slice(0, 160)}\n`)
  }
}

fs.writeFileSync(path.join(outRoot, 'manifest.json'), JSON.stringify({ builtAt: new Date().toISOString(), results }, null, 1))
const ok = results.filter((r) => r.ok).length
process.stdout.write(`\n${ok} of ${results.length} rendered. Manifest: demo/renders/manifest.json\n`)
