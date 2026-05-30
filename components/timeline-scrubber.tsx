"use client";
import * as React from "react";
import type { Session } from "@/lib/types";
import { Play, Pause, ChevronsLeft, ChevronsRight, SkipForward, SkipBack, Gauge } from "lucide-react";
import { Button } from "./ui/button";
import { EventIcon, eventMeta } from "./event-icon";
import { cn, formatRelativeTime } from "@/lib/utils";

interface Props {
  session: Session;
  selectedIndex: number;
  onSelect: (i: number) => void;
  playing: boolean;
  onPlayToggle: () => void;
  speed: number;
  onSpeedChange: (s: number) => void;
  onJumpNext: () => void;
  onJumpPrev: () => void;
}

export function TimelineScrubber({
  session, selectedIndex, onSelect, playing, onPlayToggle,
  speed, onSpeedChange, onJumpNext, onJumpPrev,
}: Props) {
  const total = session.events.length;
  const last = total - 1;
  const startMs = new Date(session.startedAt).getTime();
  const endMs = new Date(session.endedAt).getTime();
  const span = Math.max(1, endMs - startMs);

  return (
    <div className="border-t border-line bg-bg-panel/80 backdrop-blur">
      <div className="flex items-center gap-2 px-4 py-2">
        <Button variant="ghost" size="icon" onClick={() => onSelect(0)} title="Jump to start">
          <ChevronsLeft size={14} />
        </Button>
        <Button variant="ghost" size="icon" onClick={onJumpPrev} title="Previous meaningful change">
          <SkipBack size={14} />
        </Button>
        <Button variant="accent" size="icon" onClick={onPlayToggle} title={playing ? "Pause" : "Play"}>
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </Button>
        <Button variant="ghost" size="icon" onClick={onJumpNext} title="Next meaningful change">
          <SkipForward size={14} />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onSelect(last)} title="Jump to end">
          <ChevronsRight size={14} />
        </Button>

        <div className="ml-2 flex items-center gap-1.5 text-[11px] text-ink-faint">
          <Gauge size={13} />
          {[0.5, 1, 2, 4].map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={cn(
                "rounded px-1.5 py-0.5",
                speed === s ? "bg-bg-hover text-ink" : "hover:text-ink"
              )}
            >
              {s}×
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3 text-[11px] text-ink-faint">
          <span>
            Event <span className="text-ink">#{session.events[selectedIndex].sequenceNumber}</span> / {total}
          </span>
          <span>
            +{formatRelativeTime(session.startedAt, session.events[selectedIndex].timestamp)}
          </span>
          <span>
            Total {formatRelativeTime(session.startedAt, session.endedAt)}
          </span>
        </div>
      </div>

      <div className="relative px-4 pb-3 pt-1">
        <div className="relative h-8">
          {/* Track */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-line" />
          {/* Progress */}
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-gradient-to-r from-accent/80 to-accent-glow"
            style={{ width: `${(selectedIndex / Math.max(1, last)) * 100}%` }}
          />
          {/* Event ticks */}
          {session.events.map((ev, i) => {
            const ms = new Date(ev.timestamp).getTime() - startMs;
            const pct = (ms / span) * 100;
            const meta = eventMeta(ev.type);
            const isSelected = i === selectedIndex;
            const isCheckpoint = ev.type === "checkpoint";
            return (
              <button
                key={ev.id}
                onClick={() => onSelect(i)}
                className={cn(
                  "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 group",
                  "flex h-6 w-6 items-center justify-center rounded-full border bg-bg-panel transition-all",
                  isSelected ? "scale-110 border-accent/70 shadow-glow" : "border-line hover:border-line-strong",
                  isCheckpoint && !isSelected && "border-amber-400/40"
                )}
                style={{ left: `${pct}%` }}
                title={`${meta.label} · ${ev.title}`}
              >
                <EventIcon type={ev.type} className="h-3 w-3" />
                {/* Hover tooltip */}
                <span className="pointer-events-none absolute bottom-full mb-2 hidden whitespace-nowrap rounded-md border border-line bg-bg-panel px-2 py-1 text-[10.5px] text-ink shadow-md group-hover:block">
                  #{ev.sequenceNumber} · {ev.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
