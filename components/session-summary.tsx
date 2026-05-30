"use client";
import * as React from "react";
import type { Session } from "@/lib/types";
import { Badge } from "./ui/badge";
import { X } from "lucide-react";
import { Button } from "./ui/button";
import { formatRelativeTime } from "@/lib/utils";

interface Props {
  session: Session;
  onClose: () => void;
  onJumpTo: (index: number) => void;
}

export function SessionSummary({ session, onClose, onJumpTo }: Props) {
  const counts = session.events.reduce<Record<string, number>>((m, e) => {
    m[e.type] = (m[e.type] ?? 0) + 1; return m;
  }, {});
  const checkpoints = session.events.filter((e) => e.type === "checkpoint");

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative max-h-[88vh] w-[min(900px,92vw)] overflow-hidden rounded-xl border border-line bg-bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-ink-faint">Session summary</p>
            <h2 className="text-[16px] font-semibold text-ink">{session.title}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} title="Close (Esc)"><X size={14} /></Button>
        </div>

        <div className="max-h-[calc(88vh-56px)] overflow-y-auto p-5">
          {/* Top stats */}
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Duration" value={formatRelativeTime(session.startedAt, session.endedAt)} />
            <Stat label="Events" value={String(session.events.length)} />
            <Stat label="Files touched" value={String(session.filePaths.length)} />
            <Stat label="Checkpoints" value={String(checkpoints.length)} />
          </div>

          {/* Narrative */}
          <Section title="Initial request">
            <Quote>{session.events.find((e) => e.type === "user_prompt")?.content ?? "—"}</Quote>
          </Section>

          <Section title="Summary">
            <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-muted">{session.finalSummary}</p>
          </Section>

          <Section title="Phases & checkpoints">
            <ul className="space-y-2">
              {checkpoints.map((ev) => (
                <li key={ev.id}>
                  <button
                    onClick={() => { onJumpTo(session.events.indexOf(ev)); onClose(); }}
                    className="flex w-full items-center gap-3 rounded-md border border-line bg-bg-subtle px-3 py-2 text-left hover:border-accent/40"
                  >
                    <Badge tone="accent">#{ev.sequenceNumber}</Badge>
                    <span className="text-[13px] font-medium text-ink">{ev.title}</span>
                    <span className="ml-auto text-[11px] text-ink-faint">
                      +{formatRelativeTime(session.startedAt, ev.timestamp)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Shipped">
            <p className="text-[12.5px] text-ink-muted">{session.shippedSummary.headline}</p>
            <ul className="mt-3 grid grid-cols-1 gap-1.5 md:grid-cols-2">
              {session.shippedSummary.features.filter((f) => f.status === "shipped").map((f) => (
                <li key={f.name} className="flex items-start gap-2 text-[12px]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  <span>
                    <span className="font-medium text-ink">{f.name}</span>
                    <span className="text-ink-muted"> — {f.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Known gaps">
            <ul className="space-y-1.5">
              {session.shippedSummary.knownGaps.map((g) => (
                <li key={g} className="flex items-start gap-2 text-[12px] text-ink-muted">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  {g}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Event types">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(counts).map(([type, n]) => (
                <Badge key={type} tone="muted">{type} · {n}</Badge>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-bg-subtle px-3 py-2">
      <p className="text-[10.5px] uppercase tracking-widest text-ink-faint">{label}</p>
      <p className="mt-0.5 text-[18px] font-semibold text-ink">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-[11px] uppercase tracking-widest text-ink-faint">{title}</h3>
      {children}
    </section>
  );
}

function Quote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="border-l-2 border-accent/50 bg-bg-subtle/60 py-2 pl-3 pr-3 text-[12.5px] italic text-ink-muted">
      {children}
    </blockquote>
  );
}
