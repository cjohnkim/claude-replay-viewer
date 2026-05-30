"use client";
import type { Session } from "@/lib/types";
import { latestCheckpoint } from "@/lib/replay-state";
import { EventIcon, eventMeta } from "./event-icon";
import { Badge } from "./ui/badge";
import { SnapshotViewer } from "./snapshot-viewer";
import { CheckpointPanel } from "./checkpoint-panel";
import { formatClock, formatRelativeTime } from "@/lib/utils";

interface Props {
  session: Session;
  selectedIndex: number;
  compareToFinal: boolean;
}

export function StagePanel({ session, selectedIndex, compareToFinal }: Props) {
  const ev = session.events[selectedIndex];
  const meta = eventMeta(ev.type);
  const ck = latestCheckpoint(session, selectedIndex)?.checkpoint ?? null;
  // Final checkpoint = last checkpoint in session
  const finalCkEntry = latestCheckpoint(session, session.events.length - 1);
  const finalCk = finalCkEntry?.checkpoint ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-line bg-bg-subtle">
            <EventIcon type={ev.type} className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[11px] uppercase tracking-widest text-ink-faint">
              Event #{ev.sequenceNumber} · {meta.label}
            </p>
            <h1 className="text-[15px] font-semibold leading-tight text-ink">{ev.title}</h1>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-ink-faint">{formatClock(ev.timestamp)}</p>
          <p className="text-[10.5px] text-ink-faint">
            +{formatRelativeTime(session.startedAt, ev.timestamp)} into session
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-3xl space-y-5">
          {/* Content */}
          {(ev.content || ev.description) && (
            <div className="rounded-lg border border-line bg-bg-panel p-4">
              {ev.description && <p className="text-[12.5px] text-ink-muted">{ev.description}</p>}
              {ev.content && (
                <div className="mt-2 whitespace-pre-wrap rounded-md border border-line-subtle bg-bg-subtle p-3 font-sans text-[13px] leading-relaxed text-ink">
                  {ev.content}
                </div>
              )}
              {ev.metadata?.command && (
                <code className="mt-3 block rounded-md border border-line-subtle bg-bg-subtle px-3 py-2 font-mono text-[12px] text-emerald-300/90">
                  $ {ev.metadata.command}
                </code>
              )}
              {ev.metadata?.tests && (
                <ul className="mt-3 space-y-1.5">
                  {ev.metadata.tests.map((t, i) => (
                    <li key={i} className="flex items-center gap-2 text-[12px]">
                      <span className={
                        t.status === "pass" ? "h-1.5 w-1.5 rounded-full bg-emerald-400" :
                        t.status === "fail" ? "h-1.5 w-1.5 rounded-full bg-red-400" :
                        "h-1.5 w-1.5 rounded-full bg-ink-faint"
                      } />
                      <span className="text-ink-muted">{t.name}</span>
                      <span className="ml-auto text-[11px] text-ink-faint">{t.durationMs}ms</span>
                    </li>
                  ))}
                </ul>
              )}
              {ev.relatedFilePaths && ev.relatedFilePaths.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {ev.relatedFilePaths.map((p) => (
                    <Badge key={p} tone="neutral" className="font-mono normal-case tracking-normal">{p}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Snapshots */}
          {ev.snapshotIds && ev.snapshotIds.length > 0 && (
            <SnapshotViewer session={session} snapshotIds={ev.snapshotIds} compareToFinal={compareToFinal} />
          )}

          {/* Shipped state */}
          <CheckpointPanel
            session={session}
            checkpoint={ck}
            comparison={compareToFinal ? finalCk : undefined}
            label={compareToFinal ? "Shipped at this moment vs. final" : "Shipped at this moment"}
          />
        </div>
      </div>
    </div>
  );
}
