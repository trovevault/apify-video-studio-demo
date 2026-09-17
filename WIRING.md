# Wiring

Four edits in `apify-video-studio`, all guarded by `CFG.DEMO` so none of them can
be reached with the flag off.

### 1. `electron/config.js` — the flag

```js
DEMO: process.env.VIDEO_STUDIO_DEMO === '1',
```

### 2. `electron/ideas.js` — a separate store, and a way to seed it

```js
const FILE = () => path.join(DIR(), CFG.DEMO ? 'ideas-demo.json' : 'ideas.json')
```

plus `seedIdeas(list)`, which writes only into an empty store so it can never
overwrite a backlog, whichever file it is pointed at.

### 3. `electron/main.js` — serve the seven, and queue replays

`listIdeas` seeds on first read. `queueApproved` queues `{mode: 'demo', demoId}`
for each approved subject instead of planning and rendering. The queue, the
progress channel, the history and the schedule stay the real ones, so a finished
demo video lands exactly where a real one does.

### 4. `electron/orchestrator.js` — dispatch

```js
if (input.mode === 'demo') {
  const { demoReplay } = await import('../demo/mode.js')
  return demoReplay(input.demoId, emit, { cancelled: () => job.cancelled })
}
```

## Stage timings

Six stages, 36 seconds end to end. Edit `DEMO_STAGES` in `demo/mode.js` to change
them; each carries its own `hold` in milliseconds.

| stage | shown as | hold |
|---|---|---|
| ingest | Running the Apify Actor | 6s |
| ingest | Dropping accessories and duplicates | 5s |
| script | Writing the script from those numbers | 7s |
| voice | Narrating in your voice | 7s |
| visuals | Rendering 1080x1920 | 6s |
| editor | Mixing and colour correcting | 5s |
