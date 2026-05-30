# Claude Code Replay Viewer — handoff

A polished Next.js prototype that rerun a Claude Code session as an interactive
timeline. The pitch: intercut prompts, Claude responses, tool actions, file
diffs, snapshots, and checkpoints so a user can see exactly how a shipped
product evolved.

This file is the load-bearing handoff document. Read it before doing anything.

## How to run

```bash
cd ~/claude-replay-viewer
npm install        # if node_modules is gone
npm run dev        # → http://localhost:3033
```

The dev server uses port **3033** (not 3000) on purpose — set in
`package.json` `scripts.dev`.

## What's shipped

- **Picker landing page** at `/`. Project-grouped session cards with search.
- **Per-session viewer** at `/session/[id]`. Full timeline replay with:
  - Left: transcript with type filters + text search
  - Center: stage panel — event content, snapshots (with then/final compare),
    and a "Shipped at this moment" checkpoint panel
  - Right top: file tree at the selected moment (new/edited/unchanged/absent)
  - Right bottom: side-by-side diff viewer (step / file / now→final modes)
  - Bottom: timeline scrubber with play/pause, 0.5×/1×/2×/4× speed, event ticks
- **Keyboard shortcuts** (press `?` in the viewer to see them).
- **Session summary modal** (`S` in the viewer).
- **Compare-to-final mode** (`C`).
- **Three realistic mock sessions** across three projects.
- **Back-to-picker link** in the viewer header.
- **Custom 404** at `app/not-found.tsx`.

## What's mock vs. real

Everything is **mock data**. No backend, no ingestion of real Claude Code logs
yet. The data model in `lib/types.ts` is designed so real logs can be mapped
into it later — see "Future: real ingestion" below.

## Architecture

```
app/
├── page.tsx                    # picker (server component)
├── session/[id]/page.tsx       # viewer route (uses generateStaticParams)
├── not-found.tsx               # 404
├── layout.tsx                  # html shell
└── globals.css                 # tailwind + cinematic/grid bg utilities

components/
├── replay-viewer.tsx           # orchestrator — owns selectedIndex, playing,
│                               #   speed, filters, compareToFinal, modals.
│                               #   Wires keyboard shortcuts.
├── session-picker.tsx          # landing page
├── transcript-panel.tsx        # left rail
├── stage-panel.tsx             # center
├── file-tree.tsx               # right top
├── diff-viewer.tsx             # right bottom — step vs file vs final modes
├── timeline-scrubber.tsx       # bottom
├── snapshot-viewer.tsx         # used by stage-panel
├── checkpoint-panel.tsx        # "Shipped at this moment" — used by stage-panel
├── session-summary.tsx         # modal
├── event-icon.tsx              # icon+color per EventType (single source of truth)
└── ui/{button,badge}.tsx       # minimal shadcn-style primitives (no shadcn CLI)

lib/
├── types.ts                    # Session, ReplayEvent, FileChange, Snapshot,
│                               #   Checkpoint, FeatureState, Project — the
│                               #   schema is the contract.
├── sessions/
│   ├── index.ts                # registry: allSessions, getSession,
│   │                           #   groupByProject
│   ├── bunny-maze.ts           # mock #1
│   ├── auth-refactor.ts        # mock #2
│   └── csv-import.ts           # mock #3
├── replay-state.ts             # fileStateAt(session, idx), latestCheckpoint,
│                               #   latestChangeFor, nextEventOfTypes, prev
├── diff.ts                     # LCS line diff, O(n*m). Fine for prototype.
└── utils.ts                    # cn(), formatRelativeTime, formatClock, clamp
```

### Key data flow

Single source of truth in `ReplayViewer` is `selectedIndex: number`.
Everything else (file tree state, diff, snapshot, checkpoint panel,
transcript highlight, scrubber position) is **derived** from
`session.events[selectedIndex]` plus the helpers in `lib/replay-state.ts`.

`fileStateAt(session, idx)` walks events 0..idx and applies any
`file_change` side-effects in order, returning a `Map<filePath, content>`.
That powers the file tree and the diff viewer.

## Mock sessions (current registry)

1. **Bunny Maze** — Kids Games project. Single-file HTML game. Two passes:
   v1 hand-designed mazes (level 1 exit was walled in — real bug from the
   build session); v2 procgen with BFS reachability. *Self-referential — this
   was the actual session that produced the meta-content for this app.*

2. **Auth refactor** — Acme SaaS project. Legacy cookie auth → NextAuth.
   v1 wires Email + Credentials providers + middleware; v2 adds weekly JWT
   rotation in the jwt callback. Files: `lib/auth.ts`, `middleware.ts`,
   `app/layout.tsx`.

3. **CSV import** — Loop CRM project. Contacts CSV uploader. v1 whole-file
   parse with PapaParse; v2 streaming async-generator with backpressure for
   50MB+ files. Files: `lib/csv-parser.ts`, plus a route + page.

Each session has: 14–15 events, 2 checkpoints, 2 snapshots, real before/after
file content (so the diff viewer renders meaningful diffs).

## Adding more sessions

One-file operation:

1. Create `lib/sessions/<name>.ts` exporting a `Session` (use existing files
   as templates — copy the structure of `csv-import.ts`).
2. Add the import + push it into `allSessions` in `lib/sessions/index.ts`.
3. Restart dev server (or just save — Next picks up most changes).

Sessions are sorted by `startedAt` desc.

## Future: real ingestion

The intended path is to write a `mapClaudeCodeLogToSession(log) → Session`
adapter. Whatever Claude Code emits — JSONL transcript, tool-call traces,
file deltas — maps onto the `Session` shape. The viewer code does not need
to change. Pass the result to `<ReplayViewer session={session} />`.

For local file-based ingestion, the cleanest path is:

- Drop `.json` files conforming to `Session` into `public/sessions/`.
- Add a client wrapper that fetches them and feeds the picker.
- Or: a server route at `app/api/sessions/route.ts` that reads them from
  disk via `fs/promises`.

Not yet implemented. Don't build the backend until there's a real log
format to consume.

## Conventions

- **No shadcn CLI.** `components/ui/{button,badge}.tsx` are minimal
  in-house primitives styled with Tailwind. If you want more, add files in
  that folder — don't reach for the CLI (avoids interactive prompts and
  keeps deps tight).
- **Server vs client components.** App router defaults to server.
  `"use client"` is on the orchestrator and anything with `useState` /
  `useEffect`. The picker is a client component because of its search box.
  Server components (page.tsx files) import sessions and pass them as
  serialized props — keep `Session` JSON-serializable (no functions, no
  class instances).
- **Type-check before claiming done**: `npx tsc --noEmit` from the project
  root. Tailwind classnames don't get type-checked, watch them by eye.
- **Lucide icons**: import `LucideIcon` as a type when accepting an icon as
  a prop (see `session-picker.tsx`). The icon component type isn't
  `React.ComponentType<{size,className}>` — Lucide's `size` is `number |
  string`.

## Gotchas

- The directory `app/session/[id]/` must be created with **quoted** mkdir
  in zsh: `mkdir -p "app/session/[id]"` — unquoted brackets are glob chars.
- Custom Tailwind theme tokens (`bg-panel`, `ink-muted`, `line-strong`,
  etc.) are in `tailwind.config.ts`. Don't add new ad-hoc hex codes if a
  token already exists — extend the theme instead.
- `lib/diff.ts` is LCS, O(n*m). Fine for ≤2k-line files. If a real ingestion
  hits a giant file, swap for Myers or chunked diff.

## Out of scope (explicit non-goals)

- Auth, multi-user, persistence. Single-user local prototype only.
- A real log ingestion pipeline. Spec exists; implementation deferred.
- Mobile responsive. The viewer assumes desktop + keyboard.

## Open extensions / ideas

- **File upload import**: drag-and-drop a `Session` JSON onto the picker
  to add a transient session for one viewing.
- **URL-encoded session**: support `?session=<base64-json>` for share links.
- **Timeline density mode**: collapse long stretches of tool calls in the
  scrubber.
- **Diff: word-level highlighting** within changed lines (currently
  line-only).
- **Export**: "Share this moment" — capture event id + selected file as a
  permalink.
- **Real ingestion**: see "Future: real ingestion" above.

## Where to start if continuing this work

If the next session is open-ended ("make it better"), the highest-leverage
moves in order are:

1. Real Claude Code log ingestion adapter (`lib/ingest.ts`) — unlocks
   everything else.
2. File-upload + drag-and-drop on the picker — instantly demo-able.
3. URL session sharing — viral loop for the demo.

If the next session is targeted (a specific bug or feature), grep
`components/replay-viewer.tsx` first — most cross-cutting state lives there.
