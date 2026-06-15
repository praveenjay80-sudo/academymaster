# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Does
Takes any academic topic and generates a deep mastery guide. Two entry points:

**Topic pages** (`/topic/[slug]`) — 7 tabs generated per topic:
- **Concepts** — streaming NDJSON concept cards with interactive DAG dependency graph (List/Graph toggle), deep-dive panel per concept
- **Works** — streaming NDJSON work cards with chapter-by-chapter breakdown panel
- **Roadmap / Big Picture / Practice / Discover** — long-form streaming markdown tabs
- **🎓 Tutor** — Socratic chat UI; multi-turn dialogue, strict no-answer rules, session persisted in localStorage

**Standalone pages:**
- `/map` — Learning Map: waterfall of 20-35 learning stages from FOUNDATIONS → INTERMEDIATE → ADVANCED → SPECIALIZATION → RESEARCH, with named parallel specialization tracks (3-8 each with internal sequential stages), prerequisites section per card, rich concept explanations, scroll buttons on parallel blocks
- `/browse` — Domain/Field browser: 2 dropdowns from `lib/taxonomy.ts`, AI-generated theme cards grouped by big question, global search across all cached fields

## Stack
- Next.js 16 (App Router), TypeScript, React 19
- Anthropic API direct (`fetch`, no SDK) — streaming SSE format
- `@xyflow/react` + `@dagrejs/dagre` — concept dependency graph and cross-topic map graph
- Dark academic theme: navy `#0d1117`, amber `#c9a84c` (all CSS vars in `app/globals.css`)
- Railway (production), dev on port **3002**
- localStorage cache, 14-day TTL, versioned keys

## Commands
```bash
npm run dev        # start dev server on :3000 (use PORT=3002 for consistency)
npm run build      # production build — always run before deploying
npm run lint       # ESLint
railway up --detach --service academymaster   # deploy to Railway (NOT auto from git push)
```
TypeScript check (no tsc in PATH — use the local binary):
```bash
node node_modules/typescript/bin/tsc --noEmit --project tsconfig.json
```

## Environment Variables
| Variable | Where |
|---|---|
| `ANTHROPIC_API_KEY` | `.env.local` locally; Railway Variables in production |
| `MODEL_ID` | Same — default `claude-sonnet-4-6` |

`.env.local` is gitignored. System env var takes priority over `.env.local`.

**Changing model in production:** `railway variables set MODEL_ID=claude-opus-4-7 --service academymaster`
Available: `claude-haiku-4-5-20251001` (fast), `claude-sonnet-4-6` (default), `claude-opus-4-7` (best)

The client in `lib/claude.ts` also supports OpenRouter keys (`sk-or-` prefix).

## Key Files
| File | Role |
|---|---|
| `lib/claude.ts` | API client, SSE parser, `streamToController()` (single-turn), `streamChatToController()` (multi-turn for Tutor), `BEGINNER_SYSTEM` |
| `lib/prompts.ts` | All prompts — one exported function per content type |
| `lib/taxonomy.ts` | Domain → Field mapping for `/browse`; themes are AI-generated, not hardcoded |
| `components/StreamingContent.tsx` | Shared streaming UI for markdown tabs (Start/Stop/Regenerate, cache) |
| `components/ConceptGraph.tsx` | react-flow + dagre dependency graph; dynamically imported (no SSR) |
| `components/MapGraph.tsx` | react-flow cross-topic graph for the topics-you've-studied map |
| `app/topic/[slug]/layout.tsx` | Tab nav, Reset Cache, writes `topic-meta:${slug}` on first visit |
| `app/topic/[slug]/concepts/page.tsx` | NDJSON streaming + brace-counting extractor + List/Graph toggle |
| `app/topic/[slug]/works/page.tsx` | NDJSON streaming + brace-counting extractor |
| `app/topic/[slug]/tutor/page.tsx` | Socratic chat — loads concept names for context, session in localStorage |
| `app/map/page.tsx` | Learning Map waterfall — levels, named specialization tracks, scroll buttons |
| `app/browse/page.tsx` | Domain browser: 2 dropdowns, streaming theme cards grouped by big question |
| `app/globals.css` | All CSS variables |

## Streaming Architecture

**Two streaming patterns:**

1. **NDJSON (Concepts, Works, Themes, Learning Map)** — Claude outputs one JSON object per line. Client uses a brace-counting `extractObjects()` function to parse objects as they arrive. Objects accumulate in state arrays; cards render progressively.

2. **Raw markdown (Roadmap, BigPicture, Practice, Discover)** — Plain text via `StreamingContent` component. Requires explicit "▶ Generate" click. Component converts markdown to HTML with an inline `md()` function.

3. **Multi-turn chat (Tutor)** — `streamChatToController()` in `lib/claude.ts` takes a `messages: {role, content}[]` array. Each turn appends user + assistant to history; history stored in `tutor-session:${slug}` in localStorage.

**`StreamingContent` internals:**
- `cancelled` flag pattern (not `hasFetched` ref) handles React 18 StrictMode double-mount
- `gen` counter forces re-fetch on Regenerate
- `sc2:` prefix on all storage keys (bumping prefix invalidates all old caches)

## Learning Map Architecture (`/map`)

**Prompt** (`learningFlowPrompt` in `lib/prompts.ts`) generates 20-35 NDJSON stages with these fields:
- `level`: `FOUNDATIONS | INTERMEDIATE | ADVANCED | SPECIALIZATION | RESEARCH`
- `layout`: `sequential | parallel`
- `parallel_group`: shared ID for all stages in a parallel block
- `track`: named specialization track (e.g. "Algebraic Number Theory")
- `track_position`: 1-based position within the track
- `prerequisites`: string[] — what to know before starting
- `concepts`: `[{name, description}]` — 3-5 sentence rich descriptions
- `work`: `{title, authors, category, reading_time, why}` — PEDAGOGICAL/SEMINAL/BREAKTHROUGH
- `milestone`: what you can do after completing the stage

**Renderer** (`app/map/page.tsx`):
- `groupStages()` → groups parallel stages by `parallel_group`, sub-groups by `track`
- `LevelDivider` shows color-coded level transitions (green/blue/gold/purple/orange)
- `ParallelBlock` — horizontal scroll container with `‹`/`›` buttons (appear only when overflow exists); scroll buttons show/hide based on `scrollLeft` vs `scrollWidth`
- `TrackColumn` — renders one specialization track with internal mini-waterfall
- Cache key: `learning-flow-v3:${slug}` (bump version when stage shape changes)

**API:** `POST /api/learning-flow` — `max_tokens: 28000`, `maxDuration: 60`

## Adding a new streaming tab
1. Add prompt to `lib/prompts.ts`
2. Copy any `app/api/*/route.ts`, update import + `max_tokens`
3. Copy `app/topic/[slug]/roadmap/page.tsx`, update `endpoint`/`cacheKey`/`label`
4. Add to `TABS` array in `layout.tsx`
5. Add the `sc2:<tabname>:${slug}` key to `clearTopicCache()` in layout

## Cache Keys
| Key | Content |
|---|---|
| `sc2:roadmap:${slug}` | Roadmap tab raw text |
| `sc2:bigpicture:${slug}` | Big Picture tab raw text |
| `sc2:practice:${slug}` | Practice tab raw text |
| `sc2:discover:${slug}` | Discover tab raw text |
| `concepts-list-v2:${slug}` | Concepts NDJSON array |
| `works-list-v3:${slug}` | Works NDJSON array |
| `work-chapters:${topic}:${workId}` | Chapter breakdown text |
| `concept-deep:${topic}:${conceptId}` | Concept deep-dive text |
| `themes-v3:${domain}:${field}` | Themes NDJSON array for browse |
| `learning-flow-v3:${slug}` | Learning Map stages array |
| `tutor-session:${slug}` | Tutor message history array |
| `topic-meta:${slug}` | `{label, firstSeen}` — written by layout on first visit |
| `progress:concept:${id}` | User progress — NOT cleared by Reset Cache |

**Bumping cache versions:** Change the key prefix string inline in the component. `sc2:` lives in `StreamingContent.tsx`.

## API Routes
| Route | Input | max_tokens | Notes |
|---|---|---|---|
| `POST /api/concepts` | `{ topic }` | 16000 | NDJSON concepts |
| `POST /api/concept` | `{ topic, concept, prerequisites }` | 8000 | deep-dive |
| `POST /api/works` | `{ topic }` | 16000 | NDJSON works |
| `POST /api/work` | `{ topic, title, authors, type }` | 8000 | chapters |
| `POST /api/themes` | `{ domain, field }` | 8000 | NDJSON themes |
| `POST /api/roadmap` | `{ topic }` | 8000 | markdown |
| `POST /api/bigpicture` | `{ topic }` | 8000 | markdown |
| `POST /api/practice` | `{ topic }` | 8000 | markdown |
| `POST /api/discover` | `{ topic }` | 8000 | markdown |
| `POST /api/tutor` | `{ topic, conceptNames, history }` | 600 | multi-turn SSE |
| `POST /api/learning-flow` | `{ topic }` | 28000 | NDJSON stages |
| `POST /api/map-works` | `{ topic }` | 8000 | NDJSON works for map |

All routes: `export const maxDuration = 60`. All use `streamToController()` except `/api/tutor` which uses `streamChatToController()`.

## Browse Page Architecture
`/browse` is independent of topic pages. It:
1. Reads `TAXONOMY` from `lib/taxonomy.ts` (domain → string[] of fields) for the two dropdowns
2. On field select, calls `POST /api/themes` with `{ domain, field }`
3. Streams NDJSON theme objects: `{ id, name, description, big_question }`
4. Groups themes by `big_question` as they arrive (preserving insertion order)
5. Caches per `themes-v3:${domain}:${field}` — 14-day TTL
6. Global search filters across all cached themes from all previously visited fields

## Concept Graph
`ConceptGraph.tsx` is dynamically imported with `{ ssr: false }`. It:
- Uses dagre `rankdir: 'LR'`
- Node colors: green (FOUNDATIONAL), gold (INTERMEDIATE), red (ADVANCED)
- `key_works` badges render as 📚 lines inside each node
- Clicking a node calls `onSelect(concept)` → opens existing deep-dive panel

**Important:** All react-flow node data interfaces must `extend Record<string, unknown>` for TypeScript compatibility.

## Deployment
```bash
git add <files> && git commit -m "message" && git push
railway up --detach --service academymaster   # MUST run manually — Railway does NOT auto-deploy
```
Railway project: `c8e47aec-4b29-45d6-bfd8-d684756d408a`
Production: https://academymaster-production.up.railway.app
GitHub: https://github.com/praveenjay80-sudo/academymaster

## Known Limits
- `maxDuration = 60s` per route — very long topics may timeout
- localStorage ~5MB limit across all topics
- `ConceptGraph` and `MapGraph` require `dynamic(() => import(...), { ssr: false })`
- Tutor has `max_tokens: 600` to keep responses tight; system prompt enforces Socratic rules strictly
