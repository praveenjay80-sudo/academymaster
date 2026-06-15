# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Does
Takes any academic topic and generates a deep mastery guide across 6 tabs:
- **Concepts** — streaming NDJSON concept cards with DAG dependency graph, deep-dive panel
- **Works** — streaming NDJSON work cards with chapter-by-chapter breakdown panel
- **Roadmap / Big Picture / Practice / Discover** — long-form streaming markdown tabs
- **Browse by Theme** — `/browse` page: Domain → Field dropdowns, AI-generated themes grouped by big questions, global search

## Stack
- Next.js 16 (App Router), TypeScript, Tailwind CSS, React 19
- Anthropic API direct (`fetch`, no SDK) — streaming SSE format
- `@xyflow/react` + `@dagrejs/dagre` — concept dependency graph
- Dark academic theme: navy `#0d1117`, amber `#c9a84c`
- Railway (production), dev on port **3002**
- localStorage cache, 14-day TTL

## Commands
```bash
npm run dev        # start dev server on :3000 (use PORT=3002 for consistency)
npm run build      # production build — run this before deploying to catch errors
npm run lint       # ESLint
railway up --detach --service academymaster   # deploy to Railway
```
TypeScript check (no tsc in PATH — use the local binary):
```bash
node node_modules/typescript/bin/tsc --noEmit --project tsconfig.json
```

## Environment Variables
| Variable | Where |
|---|---|
| `ANTHROPIC_API_KEY` | `.env.local` locally; Railway Variables in production |
| `MODEL_ID` | Same — default `claude-haiku-4-5-20251001` |

`.env.local` is gitignored. The system `ANTHROPIC_API_KEY` env var takes priority over `.env.local`.

**Changing the model:**
- Locally: edit `MODEL_ID=` in `.env.local`
- Production: `railway variables set MODEL_ID=claude-sonnet-4-6 --service academymaster`
- Available: `claude-haiku-4-5-20251001` (fast/cheap), `claude-sonnet-4-6`, `claude-opus-4-7` (best)

The API client in `lib/claude.ts` also supports OpenRouter keys (`sk-or-` prefix) for DeepSeek or other models.

## Key Files
| File | Role |
|---|---|
| `lib/claude.ts` | Anthropic/OpenRouter API client, SSE parser, `streamToController()`, `BEGINNER_SYSTEM` prompt |
| `lib/prompts.ts` | All prompts — one exported function per content type |
| `lib/taxonomy.ts` | Domain → Field mapping for `/browse`; themes are AI-generated, not hardcoded |
| `components/StreamingContent.tsx` | Shared streaming UI for markdown tabs (Start/Stop/Regenerate, cache) |
| `components/ConceptGraph.tsx` | react-flow + dagre dependency graph; dynamically imported (no SSR) |
| `app/topic/[slug]/layout.tsx` | Tab nav + Reset Cache button + `clearTopicCache()` |
| `app/topic/[slug]/concepts/page.tsx` | NDJSON streaming + brace-counting extractor + List/Graph toggle |
| `app/topic/[slug]/works/page.tsx` | NDJSON streaming + brace-counting extractor |
| `app/browse/page.tsx` | Domain browser: 2 dropdowns, streaming theme cards grouped by big question |
| `app/globals.css` | All CSS variables |

## Streaming Architecture

**Two streaming patterns:**

1. **NDJSON (Concepts, Works, Themes)** — Claude outputs one complete JSON object per line. Client uses a brace-counting extractor to parse objects as they arrive. Objects are accumulated into state arrays; cards render progressively. Each object has a typed `_type` or `id`/`name` field for validation.

2. **Raw markdown (Roadmap, BigPicture, Practice, Discover)** — Plain text streamed via `StreamingContent` component. Requires explicit "▶ Generate" click — no auto-fetch. Component converts markdown to HTML with an inline `md()` function.

**`StreamingContent` internals:**
- `cancelled` flag pattern (not `hasFetched` ref) handles React 18 StrictMode double-mount
- `started` state prevents auto-fetch on mount; `gen` counter forces re-fetch on Regenerate
- `sc2:` prefix on all storage keys (bumping prefix invalidates all old caches across the app)

**Adding a new streaming tab:**
1. Add prompt to `lib/prompts.ts`
2. Copy any `app/api/*/route.ts`, update import + `max_tokens`
3. Copy `app/topic/[slug]/roadmap/page.tsx`, update `endpoint`/`cacheKey`/`label`
4. Add to `TABS` array in `layout.tsx`
5. Add the `sc2:<tabname>:${slug}` key to `clearTopicCache()` in layout

**Adding a new NDJSON endpoint** (like concepts/works/themes):
1. Define the JSON shape as a TypeScript interface in the page
2. Write a prompt that outputs `{"field":"value"}` one object per line — no arrays, no commas
3. Use the brace-counting `extractObjects()` pattern (copy from concepts page)
4. Validate objects by checking required fields before pushing to state

## Cache Keys
| Key | Content |
|---|---|
| `sc2:roadmap:${slug}` | Roadmap tab raw text |
| `sc2:bigpicture:${slug}` | Big Picture tab raw text |
| `sc2:practice:${slug}` | Practice tab raw text |
| `sc2:discover:${slug}` | Discover tab raw text |
| `concepts-list-v2:${slug}` | Concepts array (parsed JSON) |
| `works-list-v3:${slug}` | Works array (parsed JSON) |
| `work-chapters:${topic}:${workId}` | Chapter breakdown text |
| `concept-deep:${topic}:${conceptId}` | Concept deep-dive text |
| `themes-v3:${domain}:${field}` | Themes array for browse page |
| `progress:concept:${id}` | User progress — NOT cleared by Reset Cache |

**Bumping cache versions:** Change the key prefix string in the relevant component/page. `sc2:` is defined inline in `StreamingContent.tsx`; concept/work/theme keys are defined in their respective pages.

## Browse Page Architecture
`/browse` is independent of the topic pages. It:
1. Reads `TAXONOMY` from `lib/taxonomy.ts` (domain → string[] of fields) for the two dropdowns
2. On field select, calls `POST /api/themes` with `{ domain, field }`
3. Streams NDJSON theme objects: `{ id, name, description, big_question }`
4. Groups themes by `big_question` as they arrive (preserving insertion order)
5. Caches per `themes-v3:${domain}:${field}` — 14-day TTL
6. Global search filters across all cached themes from all previously visited fields

## Concept Graph
`ConceptGraph.tsx` is dynamically imported with `{ ssr: false }` to avoid server-side react-flow errors. It:
- Takes `concepts: ConceptItem[]` where each has `id`, `unlocks[]`, `difficulty`, `key_works?`
- Uses dagre `rankdir: 'LR'` layout computed once on mount
- Node colors: green (FOUNDATIONAL), gold (INTERMEDIATE), red (ADVANCED)
- `key_works` badges render as 📚 lines inside each node
- Clicking a node calls `onSelect(concept)` which opens the existing deep-dive panel

## API Routes
| Route | Input | max_tokens |
|---|---|---|
| `POST /api/concepts` | `{ topic }` | 16000 |
| `POST /api/concept` | `{ topic, concept, prerequisites }` | 8000 |
| `POST /api/works` | `{ topic }` | 16000 |
| `POST /api/work` | `{ topic, title, authors, type }` | 8000 |
| `POST /api/themes` | `{ domain, field }` | 8000 |
| `POST /api/roadmap` | `{ topic }` | 8000 |
| `POST /api/bigpicture` | `{ topic }` | 8000 |
| `POST /api/practice` | `{ topic }` | 8000 |
| `POST /api/discover` | `{ topic }` | 8000 |

All routes: `export const maxDuration = 60` (Railway free tier limit). All use `streamToController()` from `lib/claude.ts` with `BEGINNER_SYSTEM`.

## Deployment
```bash
git add . && git commit -m "message" && git push   # Railway does NOT auto-deploy from GitHub
railway up --detach --service academymaster         # must deploy manually via CLI
```
Railway project ID: `c8e47aec-4b29-45d6-bfd8-d684756d408a`
Production: https://academymaster-production.up.railway.app
GitHub: https://github.com/praveenjay80-sudo/academymaster

## Known Limits
- `maxDuration = 60s` per route — very long topics may timeout on Railway free tier
- localStorage ~5MB limit across all topics
- ConceptGraph requires `dynamic(() => import(...), { ssr: false })` — never import it directly in a server component or without the dynamic wrapper
