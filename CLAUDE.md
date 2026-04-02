# Both Takes — AI Debate & Mediation Platform

## What This Is
Users paste two sides of any disagreement. AI advocates debate each other, then a judge delivers a ruling with a quotable verdict. Live at bothtakes.com.

## Architecture (read this first)

**Server generates, clients observe.** This is the core principle.

```
User submits → POST /api/debate → creates DB row → after() triggers pipeline
                                                         ↓
                                              src/lib/pipeline.ts
                                              (extraction → opening → response → ruling)
                                              writes phases to Supabase as they complete
                                                         ↓
Client opens debate page → GET /api/debate/[id]/stream (read-only SSE)
                           polls DB every 1s, diffs, streams new events
```

- **Pipeline** (`src/lib/pipeline.ts`): Single writer. Uses `claimExtraction()` atomic lock — only one instance runs per debate. Called via `after()` from Next.js so it survives after the HTTP response.
- **Stream** (`src/app/api/debate/[id]/stream/route.ts`): Read-only observer. Any number of clients can connect. No generation logic.
- **Viewer** (`src/components/debate/debate-viewer.tsx`): One `useEffect`, one `EventSource`. Renders events. No orchestration.

Race conditions are eliminated by design: one writer, many readers.

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/pipeline.ts` | Full debate pipeline — extraction + 3 debate phases. The only code that calls the Anthropic API. |
| `src/lib/debate/orchestrator.ts` | Async generators that stream Claude API calls. Used by pipeline.ts. |
| `src/lib/debate/prompts.ts` | All system prompts. Stakes-aware (low=funny, high=serious). Two distinct advocate styles. |
| `src/lib/db.ts` | Supabase client. `claimExtraction()`, `joinDebate()` are atomic. `server-only` guarded. |
| `src/app/api/debate/[id]/stream/route.ts` | Read-only SSE. Polls DB, diffs, streams. 5-min timeout. |
| `src/components/debate/debate-viewer.tsx` | The debate page UI. Single EventSource consumer. ~260 lines. |
| `src/components/landing/input-form.tsx` | Landing page with "I have both sides" / "Invite the other side" toggle. |
| `src/types/index.ts` | All TypeScript types. `DebateEvent` discriminated union is the SSE protocol. |

## Debate Flow

### Both Sides Mode
1. User pastes Side A + Side B → `POST /api/debate` → creates row (status: `pending`)
2. `after()` calls `triggerPipeline()` → claims extraction atomically → runs full pipeline
3. Client at `/debate/[id]` connects to SSE stream, renders phases as they complete

### Invite Mode
1. Person A pastes their side → `POST /api/invite` → creates row (status: `waiting_for_side_b`, has `invite_token`)
2. Person A gets invite link, page polls for Side B via auto-redirect
3. Person B opens `/invite/[token]`, pastes their side → `POST /api/debate/[id]/join` → atomically sets status to `pending`
4. `after()` triggers pipeline, both clients observe via SSE

## Debate Phases
1. **Extraction** (hidden from UI) — summarizes each side's position, determines stakes (LOW/MEDIUM/HIGH)
2. **Opening Statements** — each advocate presents their side (150-200 words)
3. **Responses** — each advocate rebuts + acknowledges common ground (200-250 words)
4. **Judge's Ruling** — verdict with a quotable bold **Verdict:** line (300-400 words)

## Stakes System
Extraction outputs a `**STAKES**:` rating. This controls tone:
- **LOW** (roommate disputes, petty arguments): Funny, roast-style. "Think stand-up comedian."
- **MEDIUM** (work conflicts, friend drama): Balanced wit and substance.
- **HIGH** (relationships at risk, career decisions): Serious, empathetic. No jokes at expense of real pain.

## Tech Stack
- **Next.js 16** (App Router, Turbopack)
- **Tailwind CSS v4** with custom theme colors: `side-a` (blue), `side-b` (amber), `judge` (purple)
- **Anthropic Claude API** (Sonnet) via `@anthropic-ai/sdk`
- **Supabase** (Postgres) — single `debates` table with JSONB `phases` column
- **Vercel** — production deployment, `after()` for background pipeline execution

## Commands
```bash
npm run dev          # localhost:3001
npm run build        # production build
npm run lint         # eslint
npx tsc --noEmit     # type check
```

## Environment Variables
```
ANTHROPIC_API_KEY          # Claude API key (server-only)
NEXT_PUBLIC_SUPABASE_URL   # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY  # Supabase service role key (server-only, bypasses RLS)
NEXT_PUBLIC_POSTHOG_KEY    # PostHog analytics (optional)
NEXT_PUBLIC_POSTHOG_HOST   # PostHog host (optional)
```

## Database Schema
Single table `debates`:
```sql
id TEXT PRIMARY KEY          -- nanoid(10)
status TEXT                  -- waiting_for_side_b | pending | extracting | in_progress | completed | error
mode TEXT                    -- both_sides | invite
invite_token TEXT            -- for invite flow, unique index
input_a_type TEXT            -- claude-url | chatgpt-url | raw-text
input_a_raw TEXT             -- original input
input_b_type TEXT
input_b_raw TEXT
position_a TEXT              -- extracted position (set after extraction)
position_b TEXT
stakes TEXT                  -- low | medium | high (set after extraction)
phases JSONB                 -- array of PhaseRecord objects
error_message TEXT
created_at TIMESTAMPTZ
```

## Conventions
- Use Graphite (`gt`) for branches and PRs, not `gh`
- Never commit directly to main
- `server-only` import on any module that touches secrets
- Atomic DB operations for state transitions (`claimExtraction`, `joinDebate`)
- All AI generation happens in `pipeline.ts` → `orchestrator.ts` — nowhere else
