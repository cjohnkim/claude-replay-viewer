"use client";
import type { Session, Snapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  session: Session;
  snapshotIds: string[];
  compareToFinal?: boolean;
}

export function SnapshotViewer({ session, snapshotIds, compareToFinal }: Props) {
  if (snapshotIds.length === 0) return null;
  const snaps = snapshotIds.map((id) => session.snapshots[id]).filter(Boolean) as Snapshot[];
  // For compare-to-final, pair the latest snapshot of the matching route
  const finalByRoute: Record<string, Snapshot> = {};
  for (const s of Object.values(session.snapshots)) finalByRoute[s.route] = s;

  return (
    <div className={cn("grid gap-3", snaps.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
      {snaps.map((snap) => {
        const finalSnap = compareToFinal ? findFinalCounterpart(session, snap) : undefined;
        return (
          <div key={snap.id} className="rounded-lg border border-line bg-bg-panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <div>
                <p className="text-[12px] font-medium text-ink">{snap.title}</p>
                <p className="text-[10.5px] text-ink-faint">{snap.route}</p>
              </div>
            </div>
            <div className={cn("grid gap-0", compareToFinal && finalSnap && finalSnap.id !== snap.id ? "grid-cols-2" : "grid-cols-1")}>
              <SnapshotImage snap={snap} caption={compareToFinal && finalSnap && finalSnap.id !== snap.id ? "then" : undefined} />
              {compareToFinal && finalSnap && finalSnap.id !== snap.id && (
                <SnapshotImage snap={finalSnap} caption="final" />
              )}
            </div>
            <div className="border-t border-line px-3 py-2 text-[11.5px] text-ink-muted">
              {snap.description}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function findFinalCounterpart(session: Session, snap: Snapshot): Snapshot | undefined {
  // Prefer a later snapshot on a similar route prefix
  const baseRoute = snap.route.split("·")[0].trim();
  const candidates = Object.values(session.snapshots)
    .filter((s) => s.route.split("·")[0].trim() === baseRoute)
    .sort((a, b) => {
      const ai = session.events.findIndex((e) => e.id === a.eventId);
      const bi = session.events.findIndex((e) => e.id === b.eventId);
      return bi - ai;
    });
  return candidates[0];
}

function SnapshotImage({ snap, caption }: { snap: Snapshot; caption?: string }) {
  if (snap.imageUrl) {
    return (
      <div className="relative aspect-video bg-bg">
        <img src={snap.imageUrl} alt={snap.title} className="h-full w-full object-cover" />
        {caption && <Caption>{caption}</Caption>}
      </div>
    );
  }
  const p = snap.placeholder;
  return (
    <div className="relative aspect-video overflow-hidden" style={{ background: p?.background ?? "#16161a" }}>
      <div className="subtle-grid absolute inset-0 opacity-30" />
      <div className="relative flex h-full flex-col items-center justify-center text-center">
        <div className="text-3xl font-semibold tracking-tight text-white drop-shadow">
          {p?.label ?? snap.title}
        </div>
        {p?.sublabel && (
          <div className="mt-1.5 text-[11px] uppercase tracking-widest text-white/70">
            {p.sublabel}
          </div>
        )}
        {p?.accent && (
          <div className="mt-3 h-1 w-12 rounded-full" style={{ background: p.accent }} />
        )}
      </div>
      {caption && <Caption>{caption}</Caption>}
    </div>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute left-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-white/85 backdrop-blur">
      {children}
    </div>
  );
}
