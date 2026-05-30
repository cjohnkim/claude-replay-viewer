"use client";
import * as React from "react";
import type { ReplayEvent, Session } from "@/lib/types";
import { EventIcon, eventMeta } from "./event-icon";
import { Badge } from "./ui/badge";
import { cn, formatClock } from "@/lib/utils";
import { ChevronRight, Search } from "lucide-react";

interface Props {
  session: Session;
  selectedIndex: number;
  onSelect: (index: number) => void;
  filterTypes: Set<string>;
  search: string;
  onSearchChange: (s: string) => void;
}

export function TranscriptPanel({
  session,
  selectedIndex,
  onSelect,
  filterTypes,
  search,
  onSearchChange,
}: Props) {
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const itemRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  React.useEffect(() => {
    const ev = session.events[selectedIndex];
    if (!ev) return;
    const el = itemRefs.current[ev.id];
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedIndex, session.events]);

  const lower = search.trim().toLowerCase();
  const visible = session.events.filter((e) => {
    if (filterTypes.size > 0 && !filterTypes.has(e.type)) return false;
    if (!lower) return true;
    const hay = [e.title, e.description ?? "", e.content ?? ""].join(" ").toLowerCase();
    return hay.includes(lower);
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-faint">
          <span className="font-medium">Transcript</span>
          <span className="text-ink-faint">·</span>
          <span>{visible.length} of {session.events.length}</span>
        </div>
      </div>

      <div className="border-b border-line px-3 py-2">
        <label className="flex items-center gap-2 rounded-md border border-line bg-bg-subtle px-2 py-1.5 focus-within:border-accent/40">
          <Search size={13} className="text-ink-faint" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search transcript…"
            className="w-full bg-transparent text-[12.5px] text-ink placeholder:text-ink-faint focus:outline-none"
          />
        </label>
      </div>

      <div className="scroll-fade-y flex-1 overflow-y-auto px-2 py-3">
        <ol className="relative space-y-1.5">
          <span className="pointer-events-none absolute bottom-2 left-[19px] top-2 w-px bg-line-subtle" aria-hidden />
          {visible.map((ev) => {
            const idx = session.events.indexOf(ev);
            const isSelected = idx === selectedIndex;
            const meta = eventMeta(ev.type);
            const isCollapsible = ev.type === "tool_call" || ev.type === "command" || ev.type === "test_result";
            const isOpen = !!expanded[ev.id];
            const showBody = ev.content || ev.description || ev.metadata?.command || ev.metadata?.tests;

            return (
              <li key={ev.id} className="relative">
                <button
                  ref={(el) => { itemRefs.current[ev.id] = el; }}
                  onClick={() => onSelect(idx)}
                  className={cn(
                    "group relative flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
                    isSelected ? "bg-bg-hover ring-1 ring-accent/40" : "hover:bg-bg-subtle"
                  )}
                >
                  <span className={cn(
                    "z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-bg-panel",
                    isSelected ? "border-accent/60 shadow-glow" : "border-line"
                  )}>
                    <EventIcon type={ev.type} className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={cn("text-[12.5px] font-medium leading-tight", isSelected ? "text-ink" : "text-ink/90")}>
                        {ev.title}
                      </span>
                      <Badge tone="muted" className="ml-auto shrink-0">
                        {meta.label}
                      </Badge>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-[10.5px] text-ink-faint">
                      <span>#{ev.sequenceNumber.toString().padStart(2, "0")}</span>
                      <span>·</span>
                      <span>{formatClock(ev.timestamp)}</span>
                    </span>
                    {showBody && (
                      <div className="mt-1.5 text-[12px] text-ink-muted">
                        {isCollapsible ? (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); setExpanded((m) => ({ ...m, [ev.id]: !m[ev.id] })); }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault(); e.stopPropagation();
                                setExpanded((m) => ({ ...m, [ev.id]: !m[ev.id] }));
                              }
                            }}
                            className="inline-flex items-center gap-1 cursor-pointer text-ink-faint hover:text-ink-muted"
                          >
                            <ChevronRight size={12} className={cn("transition-transform", isOpen && "rotate-90")} />
                            <span>{isOpen ? "hide details" : "show details"}</span>
                          </span>
                        ) : (
                          <RichContent ev={ev} />
                        )}

                        {isCollapsible && isOpen && (
                          <div className="mt-2 rounded-md border border-line bg-bg-panel/60 p-2">
                            <RichContent ev={ev} expanded />
                          </div>
                        )}
                      </div>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function RichContent({ ev, expanded }: { ev: ReplayEvent; expanded?: boolean }) {
  if (ev.type === "user_prompt" || ev.type === "assistant_response") {
    return (
      <p className="whitespace-pre-wrap leading-relaxed text-ink-muted">
        {truncate(ev.content ?? "", expanded ? 1200 : 220)}
      </p>
    );
  }
  if (ev.metadata?.command) {
    return (
      <div className="space-y-1">
        <code className="block rounded bg-bg-panel px-2 py-1 font-mono text-[11.5px] text-emerald-300/90">
          $ {ev.metadata.command}
        </code>
        {ev.metadata.exitCode !== undefined && (
          <p className="text-[11px] text-ink-faint">
            exit {ev.metadata.exitCode} · {ev.metadata.durationMs ?? 0}ms
          </p>
        )}
      </div>
    );
  }
  if (ev.metadata?.tests) {
    return (
      <ul className="space-y-1">
        {ev.metadata.tests.map((t, i) => (
          <li key={i} className="flex items-center gap-2 text-[11.5px]">
            <span className={cn(
              "h-1.5 w-1.5 rounded-full",
              t.status === "pass" && "bg-emerald-400",
              t.status === "fail" && "bg-red-400",
              t.status === "skipped" && "bg-ink-faint",
            )} />
            <span className="text-ink-muted">{t.name}</span>
            <span className="ml-auto text-ink-faint">{t.durationMs}ms</span>
          </li>
        ))}
      </ul>
    );
  }
  return <p className="text-ink-muted">{ev.description}</p>;
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}
