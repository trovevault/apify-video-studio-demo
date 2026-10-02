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

## The loading state

`demo/stages.json` holds one entry, "Loading the video", with a 600ms hold so the
hand-off is not abrupt. Both `demo/mode.js` and the packaged manifest read that
file, so changing it there changes both.

It used to hold a run of stages named after the real job, timed so a
pre-rendered video looked like it was being made. That named work which was not
happening and it is gone; see the README.

Re-run `node demo/package.mjs` after changing it. The manifest embeds a copy, and
correcting the source while shipping a stale copy is the same defect twice.
