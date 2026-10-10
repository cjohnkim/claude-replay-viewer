"use client";
import * as React from "react";
import { ArrowDownRight, Network, ScanEye } from "lucide-react";
import type { Session } from "@/lib/types";
import { evidenceHandoffs, knowledgeAt, type KnowledgeCategory } from "@/lib/trace-visualization";
import { cn } from "@/lib/utils";

const COLORS = ["text-sky-300", "text-violet-300", "text-amber-300", "text-emerald-300"];
const LEFT = 166;
const RIGHT = 1016;
const WIDTH = 1052;
const HEIGHT = 296;
const laneY = (lane: number) => 55 + lane * 58;

export function AgentVisualization({ session, selectedIndex, onSelect, playing }: {
  session: Session; selectedIndex: number; onSelect: (index: number) => void; playing: boolean;
}) {
  const [showHandoffs, setShowHandoffs] = React.useState(true);
  const [visible, setVisible] = React.useState(true);
  const event = session.events[selectedIndex];
  const agents = session.agentTrace!.agents;
  const actorIndex = agents.findIndex(a => a.id === event.agent!.actorId);
  const handoffs = React.useMemo(() => evidenceHandoffs(session), [session]);
  const start = Date.parse(session.startedAt);
  const span = Math.max(1, Date.parse(session.endedAt) - start);
  const x = (index: number) => LEFT + (Date.parse(session.events[index].timestamp) - start) / span * (RIGHT - LEFT);
  const y = (index: number) => laneY(agents.findIndex(a => a.id === session.events[index].agent!.actorId));
  return <section aria-label="Agent visualization" className="min-w-0 border-b border-line bg-bg-panel/30 px-3 py-4 sm:px-5">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2"><Network size={16} className="text-accent-glow" /><h2 className="text-sm font-semibold">Watch the team work</h2><span className="text-[11px] text-ink-faint">One case · four participants</span></div>
      <button onClick={() => setVisible(v => !v)} aria-expanded={visible} aria-controls="visual-workspace" className="text-xs text-ink-muted hover:text-ink">{visible ? "Hide visualization" : "Show visualization"}</button>
    </div>
    {visible && <div id="visual-workspace" className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,1fr)]">
      <div className="min-w-0 rounded-xl border border-line bg-bg-panel">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div><h3 className="text-xs font-semibold">Agent swimlanes</h3><p className="mt-1 text-[10px] text-ink-muted">Time moves left to right. Select a numbered action to inspect it.</p></div>
          <label className="flex items-center gap-2 text-[11px] text-ink-muted"><input type="checkbox" checked={showHandoffs} onChange={e => setShowHandoffs(e.target.checked)} /> Evidence handoffs</label>
        </div>
        <div className="overflow-x-auto p-2" tabIndex={0} aria-label="Scrollable agent lanes">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full min-w-[780px]" aria-label="Chronological actions by participant" role="group" data-testid="swimlanes">
            <defs><marker id="handoff-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" className="text-accent" /></marker></defs>
            {agents.map((a, i) => <g key={a.id}>
              <rect x="0" y={laneY(i) - 24} width={WIDTH} height="48" rx="9" className={cn("fill-current", i === actorIndex ? "text-bg-hover" : "text-bg-panel")} />
              <circle cx="14" cy={laneY(i) - 3} r="3" className={cn("fill-current", COLORS[i])} />
              <text x="25" y={laneY(i)} className={cn("fill-current text-[12px] font-medium", COLORS[i])}>{a.name}</text>
              <text x="25" y={laneY(i) + 15} className="fill-current text-[9px] text-ink-faint">{a.kind === "policy_service" ? "Deterministic rules" : "Simulated agent"}</text>
              <line x1={LEFT - 18} x2={RIGHT + 10} y1={laneY(i)} y2={laneY(i)} stroke="currentColor" strokeDasharray="3 5" className="text-line-strong" />
            </g>)}
            {[0, .25, .5, .75, 1].map(t => <g key={t}>
              <line x1={LEFT + t * (RIGHT - LEFT)} x2={LEFT + t * (RIGHT - LEFT)} y1="20" y2="255" stroke="currentColor" className="text-line/70" />
              <text x={LEFT + t * (RIGHT - LEFT)} y="281" textAnchor="middle" className="fill-current text-[10px] text-ink-faint">+{Math.round(t * span / 1000)}s</text>
            </g>)}
            {showHandoffs && handoffs.filter(h => h.toIndex <= selectedIndex).map(h => {
              const isCurrent = h.toIndex === selectedIndex;
              const sx = x(h.fromIndex), sy = y(h.fromIndex), tx = x(h.toIndex), ty = y(h.toIndex);
              return <path key={`${h.fromIndex}-${h.toIndex}`} data-testid="handoff-edge" data-from={h.fromIndex} data-to={h.toIndex}
                d={`M${sx + 12},${sy} C${sx + (tx - sx) * .5},${sy} ${sx + (tx - sx) * .5},${ty} ${tx - 14},${ty}`}
                fill="none" stroke="currentColor" strokeWidth={isCurrent ? 2 : 1} markerEnd="url(#handoff-arrow)"
                className={isCurrent ? "text-accent-glow" : "text-accent/25"}>
                <title>{`${agents.find(a => a.id === session.events[h.fromIndex].agent?.actorId)?.name} → ${agents.find(a => a.id === session.events[h.toIndex].agent?.actorId)?.name}: ${h.evidenceIds.join(", ")}`}</title>
              </path>;
            })}
            <line x1={x(selectedIndex)} x2={x(selectedIndex)} y1="16" y2="255" stroke="currentColor" className="text-accent-glow/70" strokeDasharray="2 4" />
            <text x={x(selectedIndex)} y="11" textAnchor="middle" className="fill-current text-[9px] text-accent-glow">NOW</text>
            {session.events.map((e, index) => {
              const selected = index === selectedIndex;
              const reached = index <= selectedIndex;
              const lane = agents.findIndex(a => a.id === e.agent!.actorId);
              const denied = e.agent?.policy && e.agent.policy.outcome !== "allow";
              return <g key={e.id} role="button" tabIndex={0} aria-label={`Select action ${e.sequenceNumber}: ${e.title}`} aria-pressed={selected}
                data-testid="lane-action" data-reached={reached} data-event-index={index}
                onClick={() => onSelect(index)} onKeyDown={k => { if (k.key === "Enter" || k.key === " ") { k.preventDefault(); k.stopPropagation(); onSelect(index); } }}
                className={cn("cursor-pointer outline-none focus-visible:stroke-white", reached ? COLORS[lane] : "text-line-strong")}>
                <title>{`${e.title} · ${e.timestamp.slice(11, 19)} UTC${reached ? "" : " · later in replay"}`}</title>
                {selected && <circle cx={x(index)} cy={y(index)} r="21" fill="none" stroke="currentColor" strokeOpacity=".35" className={playing ? "motion-safe:animate-pulse" : ""} />}
                <circle cx={x(index)} cy={y(index)} r="14" fill="currentColor" fillOpacity={selected ? .25 : reached ? .1 : 0} stroke="currentColor" strokeWidth={selected ? 2 : 1} strokeDasharray={reached ? undefined : "2 3"} />
                <text x={x(index)} y={y(index) + 4} textAnchor="middle" className={cn("fill-current text-[10px] font-medium", reached ? "text-ink" : "text-ink-faint")}>{e.sequenceNumber}</text>
                {reached && denied && <text x={x(index) + 12} y={y(index) - 12} className="fill-current text-[11px] font-bold text-amber-300">!</text>}
                {reached && e.type === "ledger_posting" && <text x={x(index) + 12} y={y(index) - 12} className="fill-current text-[11px] font-bold text-emerald-300">✓</text>}
              </g>;
            })}
          </svg>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-3 text-[10px] text-ink-muted"><span>● Reached</span><span>◌ Later in replay</span><span>→ Recorded evidence or grant delivery</span><span className="text-amber-300">! Unmet policy</span></div>
        <div className="border-t border-line bg-bg-subtle/50 px-4 py-3">
          <p className={cn("text-[10px] uppercase tracking-wider", COLORS[actorIndex])}>{agents[actorIndex].name} · action {event.sequenceNumber}</p>
          <p className="mt-1 text-sm font-medium" data-testid="visual-action-title">{event.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">{event.description}</p>
          <a href="#event-inspector" className="mt-3 inline-flex items-center gap-1 text-xs text-accent-glow">Open event details <ArrowDownRight size={13} /></a>
        </div>
      </div>
      <KnowledgeMap key={event.id} session={session} selectedIndex={selectedIndex} onPause={() => onSelect(selectedIndex)} />
    </div>}
  </section>;
}

function KnowledgeMap({ session, selectedIndex, onPause }: { session: Session; selectedIndex: number; onPause: () => void }) {
  const [phase, setPhase] = React.useState<"before" | "after">("before");
  const [category, setCategory] = React.useState<KnowledgeCategory | null>(null);
  const event = session.events[selectedIndex];
  const actor = session.agentTrace!.agents.find(a => a.id === event.agent!.actorId)!;
  const buckets = knowledgeAt(session, selectedIndex, phase);
  const count = buckets.reduce((n, b) => n + b.snapshots.length, 0);
  const selected = buckets.find(b => b.id === category);
  const received = event.agent!.receivedEvidenceIds.length;
  const failed = event.agent?.policy?.checks.filter(c => !c.passed) ?? [];
  return <section aria-label="Knowledge map" className="min-w-0 rounded-xl border border-line bg-bg-panel" data-testid="knowledge-map">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
      <div><h3 className="flex items-center gap-2 text-xs font-semibold"><ScanEye size={14} className="text-accent-glow" /> What did this agent know?</h3><p className="mt-1 text-[10px] text-ink-muted">{actor.name} · event {event.sequenceNumber}</p></div>
      <div className="flex rounded-md border border-line p-0.5" aria-label="Knowledge time">
        {(["before", "after"] as const).map(p => <button key={p} onClick={() => { onPause(); setPhase(p); setCategory(null); }} aria-pressed={phase === p}
          className={cn("rounded px-2 py-1 text-[10px]", phase === p ? "bg-accent/15 text-accent-glow" : "text-ink-muted")}>{p === "before" ? "Before action" : "After event"}</button>)}
      </div>
    </div>
    <svg viewBox="0 0 460 295" role="group" aria-label={`${actor.name} evidence ${phase} event ${event.sequenceNumber}`} className="mx-auto w-full max-w-[500px]">
      {buckets.map(b => <line key={b.id} x1="230" y1="145" x2={b.x} y2={b.y} stroke="currentColor" strokeDasharray={b.snapshots.length ? undefined : "3 5"}
        className={b.newIds.length ? "text-emerald-300/60" : b.snapshots.length ? "text-accent/50" : "text-line"} />)}
      <rect x="156" y="112" width="148" height="66" rx="18" className="fill-bg-subtle stroke-accent/60" />
      <text x="230" y="137" textAnchor="middle" className="fill-current text-[12px] font-medium text-ink">{actor.name}</text>
      <text x="230" y="159" textAnchor="middle" className="fill-current text-[10px] text-accent-glow">{count} records · {phase === "before" ? "before acting" : "after event"}</text>
      {buckets.map(b => {
        const available = b.snapshots.length > 0;
        return <g key={b.id} role={available ? "button" : undefined} tabIndex={available ? 0 : undefined}
          aria-label={`${b.label}: ${b.snapshots.length} records`} aria-pressed={available ? category === b.id : undefined}
          data-testid={`knowledge-${b.id}`} data-count={b.snapshots.length}
          onClick={() => { if (available) { onPause(); setCategory(b.id); } }}
          onKeyDown={e => { if (available && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.stopPropagation(); onPause(); setCategory(b.id); } }}
          className={cn("outline-none focus-visible:stroke-white", available && "cursor-pointer")}>
          <rect x={b.x - 54} y={b.y - 22} width="108" height="44" rx="10" strokeWidth={category === b.id ? 2 : 1} strokeDasharray={available ? undefined : "3 4"}
            className={cn("fill-bg-panel", b.newIds.length ? "stroke-emerald-300/80" : available ? "stroke-accent/60" : "stroke-line-strong")} />
          <text x={b.x} y={b.y - 3} textAnchor="middle" className={cn("fill-current text-[10px]", available ? "text-ink" : "text-ink-faint")}>{b.label}</text>
          <text x={b.x} y={b.y + 12} textAnchor="middle" className={cn("fill-current text-[9px]", b.newIds.length ? "text-emerald-300" : available ? "text-accent-glow" : "text-ink-faint")}>{available ? `${b.snapshots.length} record${b.snapshots.length === 1 ? "" : "s"}${b.newIds.length ? ` · +${b.newIds.length} new` : ""}` : "Not supplied"}</text>
        </g>;
      })}
    </svg>
    <div className="space-y-3 px-4 pb-4 text-xs">
      <p className="text-[11px] text-ink-muted" data-testid="knowledge-phase">{phase === "before" ? "Only context supplied before this action." : "Context plus evidence received at this event."} {received > 0 && phase === "before" && `${received} new record${received === 1 ? "" : "s"} arrive at this event; choose After event to see them.`}</p>
      <p className="text-[10px] text-ink-faint">Dashed boxes mean absent from this agent’s context, not missing everywhere. Select a populated box to inspect its records.</p>
      {!!failed.length && <div className="rounded-lg border border-amber-300/25 bg-amber-300/5 p-3" data-testid="visual-policy-gaps">
        <p className="font-medium text-amber-200">{event.agent!.policy!.outcome === "deny" ? "Action blocked" : "Evidence / conditions still unmet"}</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-[11px] text-ink-muted">{failed.map(c => <li key={c.name}>{c.name}</li>)}</ul>
        <p className="mt-2 text-[10px] text-ink-faint">Decision recorded at this event; not part of its prior context.</p>
      </div>}
      {selected && selected.snapshots.length > 0 && <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-line bg-bg-subtle p-3" data-testid="map-evidence-details">
        <h4 className="font-medium">{selected.label} · recorded evidence</h4>
        {selected.snapshots.map(s => <details key={s.id} className="border-t border-line pt-2">
          <summary className="cursor-pointer text-[11px] leading-relaxed text-ink-muted">{s.summary}{selected.newIds.includes(s.id) && <span className="ml-1 text-emerald-300">New at this event</span>}</summary>
          <p className="mt-2 break-all font-mono text-[10px] text-ink-faint">{s.id} · {s.source} · v{s.version} · {s.observedAt}</p>
          <pre className="mt-2 whitespace-pre-wrap break-all text-[10px] text-ink-muted">{JSON.stringify(s.data, null, 2)}</pre>
        </details>)}
      </div>}
    </div>
  </section>;
}
