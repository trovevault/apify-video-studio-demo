# apify-video-studio-demo

Demo mode for Apify Video Studio, built for one live presentation.

The app generates ideas from the Apify Store, scrapes the products with an Apify
Actor, writes a script from what came back, narrates it, renders a vertical video
and publishes it. On stage that takes about three minutes a video, and two thirds
of it is the voice model. This holds the demo to a length a stage can carry.

## What is real here, and what is not

**Real.** The seven subjects, the Actor runs behind them, the scripts, and every
figure in every video. These videos came out of the same pipeline the app uses,
from the same cached runs, and nothing was overlaid or substituted afterwards. A
pre-rendered video is faster, not different.

**Not real.** The clock. `demo/mode.js` walks the real stage names on a timer
rather than because work is finishing, because a 190-second render does not fit
in a talk. Nothing in the output depends on that.

The distinction matters because the talk this was built for argues that no number
reaches the screen unless it came from the scrape. That claim is intact: what is
staged is when the render happened, never what it says.

## The seven subjects

Every one was run through the real `subjectFrom` pipeline. The figures are what
SURVIVES the relevance filter and the dedupe, not the raw scrape.

| subject | products | spread | stores |
|---|---|---|---|
| NERF DragonPower Firestrike Blaster | 12 | 12.4x | Walmart + Amazon |
| Elgato Stream Deck | 4 | 14.7x | Walmart |
| Canon PIXMA G3272 | 12 | 13.0x | Walmart |
| PetSafe Easy Walk Harness | 12 | 6.0x | Walmart + Amazon |
| NACON Revolution 5 Pro | 12 | 5.6x | Amazon |
| Lee Men's Dayton | 12 | 4.7x | Walmart + Amazon |
| CamelBak Cloud Walker 18 | 9 | 3.0x | Best Buy |

Raw ratios are misleading and were not used to choose these. A Petcube shelf
reads 13x raw because the cheapest row is a charger and the dearest is a camera;
after filtering it is three products at 6.1x.

### What was rejected, and why

- **amazon.es, amazon.it, amazon.in, alza.cz** — the prices are euros, rupees and
  koruna, and carry no currency, so they render as dollars. This is exactly the
  fault the `ecommerce-agent-starter` benchmark reports for its DIY arm, which
  found nine prices and all nine were in koruna.
- **Nanit Pro, Garmin Dash Cam X210** — two products after filtering. No story.
- **Starbucks capsules, Garmin Forerunner 265S** — a 1.0 to 1.1x spread. Nothing
  to say about a shelf where every price is the same.

## Running it

```bash
# once, ahead of the talk: build the seven from their cached scrapes
node demo/prerender.mjs

# then run the app in demo mode
VIDEO_STUDIO_DEMO=1 open -a "Apify Video Studio"
```

Demo mode keeps its own ideas store (`ideas-demo.json`), so seeding seven fixed
subjects can never overwrite or reorder the real backlog. `seedIdeas` refuses a
store that already has ideas, so it is idempotent.

See `WIRING.md` for the four edits this needs in the app.
