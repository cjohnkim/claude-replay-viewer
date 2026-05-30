"use client";
import * as React from "react";
import type { Session, EventType } from "@/lib/types";
import { TranscriptPanel } from "./transcript-panel";
import { StagePanel } from "./stage-panel";
import { FileTree } from "./file-tree";
import { DiffViewer } from "./diff-viewer";
import { TimelineScrubber } from "./timeline-scrubber";
import { SessionSummary } from "./session-summary";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { eventMeta } from "./event-icon";
import Link from "next/link";
import { GitBranch, Filter, BookOpen, GitCompareArrows, Keyboard, ArrowLeft } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { nextEventOfTypes, prevEventOfTypes, latestChangeFor } from "@/lib/replay-state";

const EVENT_TYPES: EventType[] = [
  "user_prompt", "assistant_response", "tool_call", "file_change",
  "command", "test_result", "snapshot", "checkpoint", "commit", "artifact",
];

const MEANINGFUL_TYPES: EventType[] = ["user_prompt", "assistant_response", "snapshot", "checkpoint", "tool_call"];

interface Props { session: Session; }

export function ReplayViewer({ session }: Props) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [selectedFile, setSelectedFile] = React.useState<string | null>(session.filePaths[0] ?? null);
  const [playing, setPlaying] = React.useState(false);
  const [speed, setSpeed] = React.useState(1);
  const [filterTypes, setFilterTypes] = React.useState<Set<EventType>>(new Set());
  const [showFilters, setShowFilters] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [compareToFinal, setCompareToFinal] = React.useState(false);
  const [showSummary, setShowSummary] = React.useState(false);
  const [showShortcuts, setShowShortcuts] = React.useState(false);

  const last = session.events.length - 1;

  // Auto-follow file: when a file_change happens at the current event, focus that file.
  React.useEffect(() => {
    const ev = session.events[selectedIndex];
    if (!ev?.diffIds || ev.diffIds.length === 0) return;
    const first = session.fileChanges[ev.diffIds[0]];
    if (first) setSelectedFile(first.filePath);
  }, [selectedIndex, session]);

  // Play loop — advances to next event on an interval scaled by speed and event spacing.
  React.useEffect(() => {
    if (!playing) return;
    if (selectedIndex >= last) { setPlaying(false); return; }
    const cur = new Date(session.events[selectedIndex].timestamp).getTime();
    const next = new Date(session.events[selectedIndex + 1].timestamp).getTime();
    const realGap = Math.max(400, Math.min(2400, (next - cur) / 4)); // compress gaps
    const wait = realGap / speed;
    const t = setTimeout(() => setSelectedIndex((i) => Math.min(i + 1, last)), wait);
    return () => clearTimeout(t);
  }, [playing, selectedIndex, last, session.events, speed]);

  // Keyboard
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      switch (e.key) {
        case " ": e.preventDefault(); setPlaying((p) => !p); break;
        case "ArrowLeft":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(0, i - 1));
          break;
        case "ArrowRight":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(last, i + 1));
          break;
        case "Home": setSelectedIndex(0); break;
        case "End": setSelectedIndex(last); break;
        case "j": jumpNext(); break;
        case "k": jumpPrev(); break;
        case "c": setCompareToFinal((v) => !v); break;
        case "s": setShowSummary(true); break;
        case "?": setShowShortcuts((v) => !v); break;
        case "Escape": setShowSummary(false); setShowShortcuts(false); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last]);

  function jumpNext() {
    const i = nextEventOfTypes(session, selectedIndex, MEANINGFUL_TYPES);
    if (i >= 0) setSelectedIndex(i);
  }
  function jumpPrev() {
    const i = prevEventOfTypes(session, selectedIndex, MEANINGFUL_TYPES);
    if (i >= 0) setSelectedIndex(i);
  }

  function toggleFilter(t: EventType) {
    setFilterTypes((s) => {
      const next = new Set(s);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  }

  const currentEvent = session.events[selectedIndex];

  return (
    <div className="cinematic-bg flex h-screen w-screen flex-col text-ink">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-line bg-bg-panel/85 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-7 items-center gap-1.5 rounded-md border border-line bg-bg-subtle px-2 text-[11.5px] text-ink-muted hover:border-accent/40 hover:text-ink"
            title="Back to sessions"
          >
            <ArrowLeft size={12} />
            <span>Sessions</span>
          </Link>
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-accent/40 bg-accent/15">
            <GitBranch size={14} className="text-accent-glow" />
          </div>
          <div className="leading-tight">
            <p className="text-[10.5px] uppercase tracking-widest text-ink-faint">
              {session.project.name} · Replay
            </p>
            <h1 className="text-[13.5px] font-medium text-ink">{session.title}</h1>
          </div>
          <Badge tone="muted" className="ml-3 normal-case tracking-normal">
            {formatRelativeTime(session.startedAt, session.endedAt)} · {session.events.length} events
          </Badge>
        </div>

        <div className="relative flex items-center gap-1.5">
          <Button variant={compareToFinal ? "accent" : "outline"} size="sm" onClick={() => setCompareToFinal((v) => !v)}>
            <GitCompareArrows size={13} />
            <span>Compare to final</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowFilters((v) => !v)}>
            <Filter size={13} />
            <span>Filters{filterTypes.size > 0 ? ` · ${filterTypes.size}` : ""}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSummary(true)}>
            <BookOpen size={13} />
            <span>Summary</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowShortcuts((v) => !v)} title="Keyboard shortcuts (?)">
            <Keyboard size={14} />
          </Button>

          {showFilters && (
            <div
              className="absolute right-0 top-full z-30 mt-2 w-64 rounded-lg border border-line bg-bg-panel p-2 shadow-2xl"
              onMouseLeave={() => setShowFilters(false)}
            >
              <p className="px-2 pb-1.5 text-[10.5px] uppercase tracking-widest text-ink-faint">Show event types</p>
              <div className="space-y-0.5">
                {EVENT_TYPES.map((t) => {
                  const meta = eventMeta(t);
                  const active = filterTypes.has(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleFilter(t)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px]",
                        active ? "bg-accent/15 text-accent-glow" : "text-ink-muted hover:bg-bg-subtle hover:text-ink"
                      )}
                    >
                      <span className={cn("h-2 w-2 rounded-full", active ? "bg-accent" : "bg-line-strong")} />
                      <span>{meta.label}</span>
                      <span className="ml-auto text-[10.5px] text-ink-faint">{t}</span>
                    </button>
                  );
                })}
              </div>
              {filterTypes.size > 0 && (
                <div className="mt-2 border-t border-line pt-2">
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => setFilterTypes(new Set())}>
                    Clear filters
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main 3-column layout */}
      <div className="grid flex-1 min-h-0 grid-cols-[320px_minmax(0,1fr)_400px]">
        {/* Left: transcript */}
        <aside className="min-h-0 border-r border-line bg-bg-panel/50">
          <TranscriptPanel
            session={session}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            filterTypes={filterTypes}
            search={search}
            onSearchChange={setSearch}
          />
        </aside>

        {/* Center: stage */}
        <main className="min-h-0">
          <StagePanel session={session} selectedIndex={selectedIndex} compareToFinal={compareToFinal} />
        </main>

        {/* Right: files + diff */}
        <aside className="min-h-0 border-l border-line bg-bg-panel/50">
          <div className="grid h-full grid-rows-[minmax(180px,38%)_minmax(0,1fr)]">
            <div className="min-h-0 border-b border-line">
              <FileTree
                session={session}
                selectedIndex={selectedIndex}
                selectedFile={selectedFile}
                onSelectFile={setSelectedFile}
              />
            </div>
            <div className="min-h-0">
              <DiffViewer
                session={session}
                selectedIndex={selectedIndex}
                selectedFile={selectedFile}
                compareToFinal={compareToFinal}
              />
            </div>
          </div>
        </aside>
      </div>

      {/* Bottom: timeline */}
      <TimelineScrubber
        session={session}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
        playing={playing}
        onPlayToggle={() => setPlaying((p) => !p)}
        speed={speed}
        onSpeedChange={setSpeed}
        onJumpNext={jumpNext}
        onJumpPrev={jumpPrev}
      />

      {showSummary && (
        <SessionSummary session={session} onClose={() => setShowSummary(false)} onJumpTo={setSelectedIndex} />
      )}
      {showShortcuts && (
        <ShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  );
}

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [
    ["Space", "Play / pause"],
    ["← / →", "Step backward / forward"],
    ["J / K", "Jump to next / previous meaningful event"],
    ["Home / End", "Jump to first / last event"],
    ["C", "Toggle compare-to-final"],
    ["S", "Open session summary"],
    ["?", "Show / hide shortcuts"],
    ["Esc", "Close modal"],
  ];
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[min(420px,92vw)] rounded-xl border border-line bg-bg-panel p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] uppercase tracking-widest text-ink-faint">Keyboard</p>
        <h2 className="mt-0.5 text-[15px] font-semibold text-ink">Shortcuts</h2>
        <ul className="mt-3 space-y-1.5">
          {rows.map(([key, desc]) => (
            <li key={key} className="flex items-center justify-between gap-3 text-[12.5px]">
              <span className="text-ink-muted">{desc}</span>
              <span className="kbd">{key}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
