# Academy Master — CLAUDE.md

## What This App Does
Takes any academic topic and generates a deep mastery guide across 6 tabs:
- **Concepts** — streaming concept cards with dependency map, deep-dive panel
- **Works** — streaming work cards with chapter-by-chapter breakdown panel
- **Roadmap / Big Picture / Practice / Discover** — long-form streaming text tabs

## Stack
- Next.js 16 (App Router), TypeScript, Tailwind CSS
- Anthropic API direct (`fetch`, no SDK) — streaming SSE format
- Dark academic theme: navy `#0d1117`, amber `#c9a84c`
- Railway (production), dev on port **3002**
- localStorage cache, 14-day TTL, `sc2:` prefix on all StreamingContent keys

## Environment Variables
| Variable | Where |
|---|---|
| `ANTHROPIC_API_KEY` | `.env.local` locally; Railway Variables in production |
| `MODEL_ID` | Same — default `claude-sonnet-4-6` |

`.env.local` is gitignored. Create it fresh on any new machine.

## Changing the Model
- **Locally**: edit `MODEL_ID=` in `.env.local`
- **Production**: `railway variables set MODEL_ID=claude-opus-4-7`
- **Available**: `claude-haiku-4-5-20251001` (fast/cheap), `claude-sonnet-4-6` (default), `claude-opus-4-7` (best)

## Key Files
| File | Role |
|---|---|
| `lib/claude.ts` | Anthropic API client, SSE parser, model/key detection |
| `lib/prompts.ts` | All prompts — one exported function per tab |
| `components/StreamingContent.tsx` | Shared streaming UI (Start/Stop/Regenerate, blinking cursor) |
| `app/topic/[slug]/layout.tsx` | Tab nav + Reset Cache button |
| `app/topic/[slug]/concepts/page.tsx` | Concepts tab — streaming NDJSON + card renderer |
| `app/topic/[slug]/works/page.tsx` | Works tab — streaming NDJSON + card renderer |
| `app/globals.css` | All CSS variables |
| `app/api/*/route.ts` | One streaming API route per tab |

## Streaming Architecture
- **Concepts & Works**: NDJSON output (one JSON object per line). Client uses brace-counting extractor to parse objects as they arrive. Cards render progressively.
- **Roadmap / BigPicture / Practice / Discover**: Raw markdown streamed via `StreamingContent` component. Requires explicit "▶ Generate" click — no auto-fetch.
- **`StreamingContent`**: Uses `cancelled` flag pattern (not `hasFetched` ref) to handle React StrictMode double-mount correctly. `sc2:` prefix on storage keys invalidates old cache.

## Adding a New Tab
1. Add prompt function to `lib/prompts.ts`
2. Copy an existing `app/api/*/route.ts` and update the import + max_tokens
3. Copy a page file (e.g. `roadmap/page.tsx`) and update `endpoint`, `cacheKey`, `label`
4. Add to `TABS` array in `app/topic/[slug]/layout.tsx`
5. Add the `sc2:<tabname>:${slug}` key to `clearTopicCache()` in the same layout file

## Deployment
```bash
git add . && git commit -m "message" && git push   # Railway auto-deploys
```
Production: https://academymaster-production.up.railway.app
GitHub: https://github.com/praveenjay80-sudo/academymaster

## Cache Strategy
- `sc2:roadmap:${slug}`, `sc2:bigpicture:${slug}`, etc. — StreamingContent tabs
- `concepts-list-v2:${slug}` — concepts list
- `works-list-v3:${slug}` — works list
- `work-chapters:${topic}:${workId}` — individual work breakdowns
- `concept-deep:${topic}:${conceptId}` — individual concept deep-dives
- `progress:concept:${id}` — user progress (NOT cleared by Reset Cache)
- Reset Cache button clears all above except progress, then reloads

## Known Limits
- `maxDuration = 60s` per route — very long topics may timeout on Railway free tier
- localStorage ~5MB limit across all topics
- NotebookLM tab UI exists but backend integration requires `nlm login` setup
