"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldCheck, Layers, RotateCcw } from "lucide-react";
import type { Session, ReplayEvent, EventType } from "@/lib/types";
import type { EvidenceSnapshot, JsonValue } from "@/lib/agent-trace";
import { businessStateAt, contextAtEvent } from "@/lib/agent-trace";
import { createAchDemo, SCENARIOS, type Scenario } from "@/lib/demo/ach-trace";
import { AgentVisualization } from "./agent-visualization";
import { TimelineScrubber } from "./timeline-scrubber";
import { TranscriptPanel } from "./transcript-panel";
import { useReplayPlayback } from "./use-replay-playback";
import { EventIcon, eventMeta } from "./event-icon";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

const money = (value: JsonValue | undefined) => typeof value === "number"
  ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 100) : "—";
const time = (value: string) => `${value.slice(11, 19)} UTC`;

export function BankDemo() {
  const [scenario, setScenario] = React.useState<Scenario>("eligible");
  const session = React.useMemo(() => createAchDemo(scenario), [scenario]);
  return <BankReplayViewer key={scenario} session={session} scenario={scenario} onScenario={setScenario} />;
}

function BankReplayViewer({ session, scenario, onScenario }: {
  session: Session; scenario: Scenario; onScenario: (scenario: Scenario) => void;
}) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [speed, setSpeed] = React.useState(1);
  const [agentId, setAgentId] = React.useState("");
  const [eventType, setEventType] = React.useState("");
  const [search, setSearch] = React.useState("");
  const stop = React.useCallback(() => setPlaying(false), []);
  useReplayPlayback(session.events, selectedIndex, playing, speed, setSelectedIndex, stop);
  const select = React.useCallback((index: number) => { setPlaying(false); setSelectedIndex(index); }, []);
  const last = session.events.length - 1;
  const event = session.events[selectedIndex];
  const state = businessStateAt(session, selectedIndex);
  const trace = session.agentTrace!;
  const actor = trace.agents.find(a => a.id === event.agent!.actorId)!;
  const hasFilters = !!(agentId || eventType || search);
  const reset = () => { select(0); setAgentId(""); setEventType(""); setSearch(""); setSpeed(1); };

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, button, a, [contenteditable=true]")) return;
      if (e.key === " ") { e.preventDefault(); setPlaying(p => !p); }
      else if (e.key === "ArrowRight") { e.preventDefault(); select(Math.min(last, selectedIndex + 1)); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); select(Math.max(0, selectedIndex - 1)); }
      else if (e.key === "Home") { e.preventDefault(); select(0); }
      else if (e.key === "End") { e.preventDefault(); select(last); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [last, selectedIndex, select]);

  return (
    <div className="cinematic-bg flex min-h-screen flex-col text-ink">
      <header className="border-b border-line bg-bg-panel/90 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink"><ArrowLeft size={13} /> Claude replays</Link>
            <span className="text-ink-faint">/</span>
            <span className="flex items-center gap-2 text-sm font-semibold"><Layers size={17} className="text-accent-glow" /> Twisp Lens</span>
            <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-amber-200">Synthetic replay</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-ink-muted" htmlFor="scenario">Scenario</label>
            <select id="scenario" value={scenario} onChange={e => onScenario(e.target.value as Scenario)} className="max-w-[240px] rounded-md border border-line bg-bg-panel p-2 text-xs">
              {Object.entries(SCENARIOS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
            <Button onClick={reset} size="sm"><RotateCcw size={12} /> Reset</Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink-faint">Cedar Bank · Payment operations · {trace.caseId}</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">{session.title}</h1>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-muted">Follow a $4,800 return from investigation to a policy-authorized credit. Three simulated agents, one policy service. No live model, bank or Twisp connection.</p>
          </div>
          <p className="text-[11px] text-ink-faint">{session.events.length} events · 8-second intervals · Space to play</p>
        </div>
      </header>

      <AgentVisualization session={session} selectedIndex={selectedIndex} onSelect={select} playing={playing} />

      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-bg-panel/60 px-5 py-2">
        <label htmlFor="agent" className="text-xs text-ink-muted">Agent</label>
        <select id="agent" value={agentId} onChange={e => setAgentId(e.target.value)} className="rounded border border-line bg-bg-panel px-2 py-1 text-xs">
          <option value="">All participants</option>
          {trace.agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <label htmlFor="event-type" className="ml-2 text-xs text-ink-muted">Event</label>
        <select id="event-type" value={eventType} onChange={e => setEventType(e.target.value)} className="rounded border border-line bg-bg-panel px-2 py-1 text-xs">
          <option value="">All types</option>
          {([...new Set(session.events.map(e => e.type))] as EventType[]).map(t => <option key={t} value={t}>{eventMeta(t).label}</option>)}
        </select>
        {hasFilters && <button onClick={() => { setAgentId(""); setEventType(""); setSearch(""); }} className="text-xs text-accent-glow">Clear filters</button>}
        <p className="ml-auto text-[10.5px] text-ink-faint">Filters narrow the transcript. Playback and state follow the full case.</p>
      </div>

      <div className="grid min-h-0 lg:h-[640px] lg:grid-cols-[320px_minmax(0,1fr)_290px] xl:grid-cols-[350px_minmax(0,1fr)_310px]">
        <aside aria-label="Case transcript" className="h-[380px] border-b border-line bg-bg-panel/50 lg:h-auto lg:min-h-0 lg:border-b-0 lg:border-r">
          <TranscriptPanel session={session} selectedIndex={selectedIndex} onSelect={select} filterTypes={new Set(eventType ? [eventType] : [])} search={search} onSearchChange={setSearch} agentId={agentId} scrollWithinPanel />
        </aside>
        <main id="event-inspector" aria-label="Event inspection" className="min-w-0 overflow-y-auto p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg border border-line bg-bg-panel p-3"><EventIcon type={event.type} className="h-5 w-5" /></div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-ink-faint">Event {event.sequenceNumber} · {eventMeta(event.type).label} · {time(event.timestamp)}</p>
              <h2 className="mt-1 text-lg font-semibold" data-testid="event-title">{event.title}</h2>
              <p className="mt-1 text-xs text-accent-glow">{actor.name} <span className="text-ink-faint">· {actor.kind === "policy_service" ? "deterministic service" : "simulated agent"}</span></p>
            </div>
          </div>
          <p className="mb-5 text-sm leading-relaxed text-ink-muted">{event.description}</p>
          <div className="space-y-4">
            <EvidenceList title="What this agent knew before acting" snapshots={contextAtEvent(session, event)} empty="No evidence had been delivered to this participant before this event." testId="context-before" />
            {event.agent!.receivedEvidenceIds.length > 0 && <EvidenceList title="New evidence received at this event" snapshots={event.agent!.receivedEvidenceIds.map(id => trace.evidence[id])} empty="" testId="context-received" />}
            <EventDetails event={event} />
            <section className="rounded-lg border border-line bg-bg-panel p-4">
              <h3 className="text-xs font-medium text-ink-muted">Audit references</h3>
              <dl className="mt-2 grid grid-cols-[80px_minmax(0,1fr)] gap-1 text-[11px]">
                <dt className="text-ink-faint">Event</dt><dd className="font-mono">{event.id}</dd>
                <dt className="text-ink-faint">Run</dt><dd className="break-all font-mono">{event.agent!.runId}</dd>
                <dt className="text-ink-faint">Follows</dt><dd>{event.agent!.causedBy.length ? event.agent!.causedBy.map(id => <button key={id} onClick={() => select(session.events.findIndex(e => e.id === id))} className="mr-2 font-mono text-accent-glow underline">{id}</button>) : "Case start"}</dd>
              </dl>
            </section>
          </div>
        </main>
        <aside aria-label="Business state" className="overflow-y-auto border-t border-line bg-bg-panel/60 p-4 lg:border-l lg:border-t-0">
          <p className="text-[10px] uppercase tracking-widest text-ink-faint">Business state at this moment</p>
          <p className="mt-1 text-[11px] text-ink-muted">Includes all events through #{event.sequenceNumber}</p>
          <div className="mt-4 space-y-3" data-testid="business-state">
            <Stat label="Account access" value={String(state.accountStatus).replaceAll("_", " ")} />
            <Stat label="Case" value={String(state.caseStatus)} />
            <Stat label="Customer return credit" value={money(state.customerBalanceMinor)} />
            <Stat label="Unallocated return" value={money(state.unallocatedMinor)} />
            <Stat label="Account version" value={`v${state.version}`} />
          </div>
          <div className="mt-5 rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-xs leading-relaxed text-ink-muted">
            <ShieldCheck size={15} className="mb-2 text-amber-200" />
            Restricted return credit only. General account access and outgoing payments stay disabled.
          </div>
          <h3 className="mt-6 text-xs font-medium">Authorization trail</h3>
          <div className="mt-2 space-y-2" data-testid="authorization-trail">
            {session.events.slice(0, selectedIndex + 1).filter(e => e.agent?.policy).map(e => (
              <button key={e.id} onClick={() => select(session.events.indexOf(e))} className="flex w-full items-center justify-between gap-2 rounded border border-line px-2 py-2 text-left text-[11px] hover:bg-bg-hover">
                <span>{e.agent!.policy!.id}</span><span className={e.agent!.policy!.outcome === "allow" ? "text-emerald-300" : "text-amber-200"}>{e.agent!.policy!.outcome.replaceAll("_", " ")}</span>
              </button>
            ))}
            {!session.events.slice(0, selectedIndex + 1).some(e => e.agent?.policy) && <p className="text-xs text-ink-faint">No decision yet.</p>}
          </div>
          <h3 className="mt-5 text-xs font-medium">Posting receipt</h3>
          <p className="mt-2 break-all font-mono text-xs text-ink-muted" data-testid="posting-receipt">{state.postingId ? String(state.postingId) : "No posting yet"}</p>
          <p className="mt-6 text-[11px] leading-relaxed text-ink-faint">All names, records and permissions are fictional. Replay never performs a financial write. Balances and effects come from a deterministic in-memory simulator.</p>
        </aside>
      </div>
      <div className="sticky bottom-0 z-20 overflow-x-auto bg-bg-panel">
        <TimelineScrubber session={session} selectedIndex={selectedIndex} onSelect={select} playing={playing}
          onPlayToggle={() => { if (!playing && selectedIndex === last) setSelectedIndex(0); setPlaying(p => !p); }} speed={speed} onSpeedChange={setSpeed}
          onJumpNext={() => select(Math.min(last, selectedIndex + 1))} onJumpPrev={() => select(Math.max(0, selectedIndex - 1))} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-line bg-bg-subtle px-3 py-2"><p className="text-[10px] text-ink-faint">{label}</p><p className="mt-1 text-sm font-medium capitalize">{value}</p></div>;
}
function EvidenceList({ title, snapshots, empty, testId }: { title: string; snapshots: EvidenceSnapshot[]; empty: string; testId: string }) {
  return <section className="rounded-lg border border-line bg-bg-panel p-4" data-testid={testId}>
    <h3 className="text-xs font-semibold">{title} <span className="ml-1 text-ink-faint">{snapshots.length}</span></h3>
    {snapshots.length === 0 ? <p className="mt-2 text-xs text-ink-faint">{empty}</p> : <div className="mt-3 space-y-2">
      {snapshots.map(s => <details key={s.id} className="rounded border border-line bg-bg-subtle px-3 py-2">
        <summary className="cursor-pointer text-xs leading-relaxed text-ink-muted">{s.summary}<span className="mt-1 block break-all font-mono text-[10px] text-ink-faint">{s.id} · source v{s.version} · observed {time(s.observedAt)}</span></summary>
        <p className="mt-2 break-all text-[10px] text-ink-faint">Source: {s.source}</p>
        <Json value={s.data} />
      </details>)}
    </div>}
  </section>;
}
function EventDetails({ event }: { event: ReplayEvent }) {
  const { policy, tool, stateChanges, ledgerEffects } = event.agent!;
  return <>
    {policy && <section className="rounded-lg border border-amber-300/25 bg-bg-panel p-4" data-testid="policy-decision">
      <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Policy decision</h3><span className={cn("rounded-full px-2 py-1 text-[10px] uppercase", policy.outcome === "allow" ? "bg-emerald-300/10 text-emerald-300" : "bg-amber-300/10 text-amber-200")}>{policy.outcome.replaceAll("_", " ")}</span></div>
      <p className="mt-2 break-all font-mono text-[10px] text-ink-faint">{policy.policyId}@{policy.policyVersion} · {policy.action}</p>
      <ul className="mt-3 space-y-2">{policy.checks.map(c => <li key={c.name} className="text-xs"><span className={c.passed ? "text-emerald-300" : "text-amber-200"}>{c.passed ? "PASS" : "WAIT / DENY"}</span> <span className="text-ink">{c.name}</span><p className="mt-0.5 text-[11px] text-ink-faint">{c.detail}</p></li>)}</ul>
      {policy.grant && <details className="mt-3"><summary className="cursor-pointer text-xs text-accent-glow">Inspect bound grant</summary><Json value={policy.grant} /></details>}
    </section>}
    {tool && <section className="rounded-lg border border-line bg-bg-panel p-4">
      <h3 className="text-xs font-semibold">Tool invocation · <span className="font-mono text-accent-glow">{tool.name}</span></h3>
      <div className="mt-3 grid gap-3 xl:grid-cols-2"><div><p className="text-[10px] text-ink-faint">INPUT AT INVOCATION</p><Json value={tool.input} /></div><div><p className="text-[10px] text-ink-faint">RESULT AT COMPLETION</p><Json value={tool.output} /></div></div>
    </section>}
    {!!stateChanges?.length && <section className="rounded-lg border border-line bg-bg-panel p-4"><h3 className="text-xs font-semibold">Resulting state changes</h3><ul className="mt-3 space-y-2">{stateChanges.map(c => <li key={c.field} className="text-xs"><p className="font-mono text-ink-faint">{c.field}</p><p className="mt-1 flex flex-wrap items-center gap-2"><span>{String(c.before)}</span><ArrowRight size={11} /><span className="text-emerald-300">{String(c.after)}</span></p>{c.authorizationId && <p className="mt-1 text-[10px] text-ink-faint">Authorized by {c.authorizationId}</p>}</li>)}</ul></section>}
    {!!ledgerEffects?.length && <section className="rounded-lg border border-emerald-300/25 bg-bg-panel p-4"><h3 className="text-xs font-semibold">Balanced ledger effects</h3>{ledgerEffects.map(l => <div key={l.postingId}><p className="mt-2 break-all font-mono text-[10px] text-ink-faint">{l.postingId} · {l.operationId}</p><table className="mt-3 w-full text-left text-xs"><thead><tr className="text-ink-faint"><th className="pb-2 font-normal">Account</th><th className="pb-2 font-normal">Side</th><th className="pb-2 text-right font-normal">USD</th></tr></thead><tbody>{l.entries.map(e => <tr key={e.account} className="border-t border-line"><td className="py-2 pr-2">{e.account}</td><td>{e.side}</td><td className="text-right">{money(e.amountMinor)}</td></tr>)}</tbody></table></div>)}</section>}
  </>;
}
function Json({ value }: { value: unknown }) {
  return <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-bg-subtle p-2 font-mono text-[10px] leading-relaxed text-ink-muted">{JSON.stringify(value, null, 2)}</pre>;
}
