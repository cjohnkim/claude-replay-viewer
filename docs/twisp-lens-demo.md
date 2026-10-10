# Twisp Lens: isolated ACH trace demonstration

This branch adds `/demo/ach` to the existing Claude Code replay viewer. It demonstrates inspection of a bank-agent workflow using deterministic synthetic data. It does not run a model, call Twisp, contact a bank, or transmit an ACH file. No credentials are required.

## Run

Use Node 20.9+ and the committed lockfile:

```bash
npm ci
npm run dev
# http://localhost:3033/demo/ach
```

The session picker links to the demo. `/` and `/session/[id]` retain Claude JSONL ingestion from `~/.claude/projects/`. An optional server-only `CLAUDE_PROJECTS_DIR` selects another root; browser tests use this to read only the committed synthetic coding fixture. The bank route imports its fixtures directly and never reads local Claude logs.

## Scenario and accounting

Northstar sent an outgoing $4,800 ACH credit to a supplier. The supplier's receiving account is closed, producing an incoming R02 return. Separately, Northstar's own account at the fictional Cedar Bank closed administratively after the payment. These are two distinct accounts. The demonstration starts with funds already recorded in an unallocated return liability, and a return notification that still needs independent settlement evidence.

The investigator reads the notification, account status and fictional policy. The policy service initially reports missing original-debit, settlement and closure evidence. An evidence agent retrieves those records and explicitly hands them back. Only then can the policy service issue a grant to the posting agent.

The first grant permits a transition from `closed` to `return_credit_only`. This is **a fictional bank policy and state**, not an ACH network requirement or a claim that a real bank or Twisp supports reopening. The account cannot originate payments or resume general activity. A second, separate grant permits allocation of the exact returned amount against the updated state. Both are bounded by principal, action, operation, policy version, expected state version and expiry; execution checks current permission, eligibility and funds again.

| Resolution entry | Debit | Credit |
| --- | --- | --- |
| Unallocated return liability | $4,800 | — |
| Northstar deposit liability | — | $4,800 |

The receipt was already booked, so the resolution does not touch settlement cash or perform another ordinary return reversal. On success, the customer balance is $4,800, unallocated funds are zero, and the case is resolved. The account remains restricted. Later disposition of the balance or full reopening is outside this demonstration.

The simulator separates the account transition and allocation, each with its own state version and authorization. It does not claim distributed atomicity between those actions. A production system would need recovery if it failed between them.

## Demonstration script

1. Open the eligible scenario. The first event has no prior context; its inbound record appears under **New evidence received**.
2. Select event 5. The policy is waiting for three missing facts and has no grant.
3. Select events 7–9. Inspect each tool's inputs/results and versioned evidence. The record returned by a tool is not shown as something the agent knew before invoking it.
4. Select event 12. Inspect policy checks and the bound grant.
5. Select event 14. Observe the restricted account-state transition, with no posting yet.
6. Select events 16 and 18. Inspect the second grant, balanced posting and before/after state.
7. Select the final event. The investigator has now received the execution receipts and can report the verified result.
8. Filter to an agent or event type, or search the transcript. Filters affect only the transcript; the timeline, selected event and global business state continue to represent the full case. Clear filters or reset as needed.
9. Switch to the missing-evidence, fraud-closure or duplicate-delivery scenario. The first two hold without financial effects. The last returns the existing receipt without another posting.

Playback uses the existing compressed timing (0.5×, 1×, 2×, 4×), not measured agent or human time. Fixture events are deterministically spaced eight seconds apart. No savings or performance claims are inferred from them.

## Implementation and reuse

| Piece | What is reused or added |
| --- | --- |
| `ReplayEvent` / `Session` | Optional agent-trace extension; coding fixtures and real JSONL sessions require no migration |
| `TimelineScrubber` | Reused directly; progress now follows timestamp position rather than event ordinal; safe empty-state handling and event labels added |
| `TranscriptPanel` | Reused directly, including chronological selection, tool expansion, text search and event filtering; optional agent filtering and identity labels added |
| `useReplayPlayback` | Extracted the existing chronological timer so both viewers use the same behavior |
| `ReplayViewer` | Keeps the coding-oriented panels and route; shares the playback hook |
| `BankReplayViewer` | New bank inspection surface with context before action, newly received evidence, tool I/O, policy checks, effects, receipts and causal navigation |
| `lib/agent-trace.ts` | Typed trace envelope, cursor projection and deterministic fixture/provenance validation |
| `lib/demo/bank-simulator.ts` | Pure in-memory policy evaluation and bounded execution, with version and duplicate guards |
| `lib/demo/ach-trace.ts` | Fixed sources, identities and clock; generates the four replay fixtures from simulator results |
| `lib/ingest.ts` | Claude parser is preserved; exported for regression tests and accepts an isolated optional source root |

Each participant has a stable identity and run ID. Every event records its case, causal predecessors, exact context snapshot IDs and newly delivered evidence IDs. Evidence stores content, source version and observation time. Policy and execution events link authorization and effects to the same operation. The replay never reconstructs past knowledge by fetching the latest record.

The fixture builder deliberately records all previously delivered evidence as the context supplied to that participant's next action. Real adapters must capture the actual context selected for each invocation, including truncation/retrieval decisions. Possession of a record does not prove a model used it or understood it.

## Regression checks

```bash
npm run check       # TypeScript, ESLint, deterministic and Claude regression tests
npm run build       # optimized Next build
npx playwright install chromium
npm run test:e2e    # browser interactions using isolated synthetic Claude logs
```

The tests exercise deterministic serialization, per-agent knowledge and no future evidence, causal references, grant-before-effect ordering, balanced accounting, historical state reconstruction, missing evidence, fraud restrictions, stale state, expired and revoked authorization, wrong principal/action/operation, commit-time rechecks and duplicate suppression. Claude coverage includes parsing, tools, tokens, markers, hidden-thinking exclusion, file discovery, file-state replay and the original UI's shared playback.

Browser tests cover context inspection, filters including an empty result, rewind/reset, playback completion, all scenario outcomes, desktop/mobile layout and a real synthetic JSONL session route. Playwright uses port 3034 and starts/stops its own server.

Validation completed in the implementation environment: 25 model/ingestion tests, all eight browser checks, TypeScript, ESLint and an optimized Next build. Desktop and mobile screenshots were also inspected.

The repository previously had no test suite and `next lint` prompted for configuration. This branch supplies a minimal Next ESLint configuration, fixes an existing unescaped apostrophe in the 404 page, and explicitly retains plain image rendering for arbitrary local replay image sources.

## Production boundaries

This is a useful **single-case Lens inspector and adapter contract**. It is not a production event store, bank authorization service or swarm visualization.

| Current approach | Change needed for production scale |
| --- | --- |
| Whole session serialized into the browser; one DOM tick and transcript entry per event | Paginated/time-windowed queries, virtualized rows, grouped coincident timestamps, aggregated timeline bins and a canvas/WebGL layer for large populations |
| Repeated scans, `indexOf`, and prefix replay from event zero | Indexed event/agent/case lookups, incremental projections and periodic checkpoints; profile with realistic workloads |
| One case, one account, flat state fields | Entity-scoped projections, multi-case/cross-agent causal graph, correlation IDs and explicit event ordering under late/duplicate delivery |
| Serial fixed fixture and in-memory duplicate guard | Durable inbox/outbox, database uniqueness/CAS, ledger receipts, reconciliation after unknown outcomes, recovery between separate account and ledger commits |
| Evidence stored in the same client bundle | Immutable versioned evidence storage, content integrity, access controls, retention/redaction and separation between event time and ingestion time |
| Typed records plus a fixture validator | Versioned external schemas and runtime validation, size limits, provenance checks and migrations before importing arbitrary traces |
| Fictional grant object and booleans from trusted fixtures | Independent authenticated authorization and bank-approved rules; trusted source verification; atomic enforcement at each actual write boundary |
| Exact-match single-case examples | Held-out evaluations, ambiguous/mismatched record cohorts, failure injection and outcome reconciliation before live integrations |
| No model, router, multi-agent runtime or Twisp tenant | Adapters emitting real context/tool/decision/commit receipts into the same inspection envelope |

Coincident timestamps in existing Claude logs can overlap timeline dots; transcript selection and step controls remain available. This is another reason to group/aggregate markers before scaling the renderer.

The validation helper catches fixture consistency errors; it is not a cryptographic audit guarantee or an untrusted-input security boundary. Grants are plain in-memory demo objects. The sequential duplicate test is not proof of concurrency safety in a multi-worker system. No large-population benchmark, distributed failure test or live financial integration was performed.

A practical next step is to feed one real development-runtime trace into this envelope while keeping authorization and ledger truth outside the viewer. Reuse the event inspector and timeline interaction patterns; redesign the data retrieval and aggregate rendering before attempting a galaxy of thousands of agents.
