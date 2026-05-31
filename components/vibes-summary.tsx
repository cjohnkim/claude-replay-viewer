"use client";
import * as React from "react";
import Link from "next/link";
import type { Session, Project } from "@/lib/types";
import { MARKER_CATEGORIES, MARKER_META, type MarkerCategory } from "@/lib/markers";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface Props {
  groups: { project: Project; sessions: Session[] }[];
  open: boolean;
  onClose: () => void;
}

/**
 * Slide-in analytics drawer summarizing marker activity across the whole
 * collection. Shows:
 *   - Total per-category counts + sessions touched
 *   - Top 3 sessions by each category
 *   - Per-project heat (which projects accumulate which categories)
 *   - A time-of-day distribution histogram (24 buckets, summed across all
 *     marker events) — surfaces patterns like "I get frustrated most often
 *     in the afternoon"
 */
export function VibesSummary({ groups, open, onClose }: Props) {
  const allSessions = React.useMemo(
    () => groups.flatMap((g) => g.sessions.map((s) => ({ session: s, project: g.project }))),
    [groups]
  );

  // Per-category aggregates: total count, total event count, top 3 sessions.
  const perCategory = React.useMemo(() => {
    const out: Record<
      MarkerCategory,
      { count: number; eventCount: number; topSessions: { session: Session; project: Project; count: number }[] }
    > = {} as never;
    for (const c of MARKER_CATEGORIES) {
      const all = allSessions
        .map(({ session, project }) => ({
          session,
          project,
          count: session.markers?.[c]?.count ?? 0,
          eventCount: session.markers?.[c]?.eventIds.length ?? 0,
        }))
        .filter((x) => x.count > 0);
      const total = all.reduce((n, x) => n + x.count, 0);
      const totalEvents = all.reduce((n, x) => n + x.eventCount, 0);
      const top = all.sort((a, b) => b.count - a.count).slice(0, 3);
      out[c] = { count: total, eventCount: totalEvents, topSessions: top };
    }
    return out;
  }, [allSessions]);

  // Per-project heat: marker counts per project.
  const perProject = React.useMemo(() => {
    return groups.map((g) => {
      const counts: Record<MarkerCategory, number> = {} as never;
      let total = 0;
      for (const c of MARKER_CATEGORIES) {
        let n = 0;
        for (const s of g.sessions) n += s.markers?.[c]?.count ?? 0;
        counts[c] = n;
        total += n;
      }
      return { project: g.project, counts, total, sessionCount: g.sessions.length };
    }).sort((a, b) => b.total - a.total);
  }, [groups]);

  // Time-of-day distribution: 24 buckets, summed marker events across all
  // sessions. Uses each event's timestamp hour as the bucket key.
  const hourBuckets = React.useMemo(() => {
    const buckets: Record<MarkerCategory, number[]> = {} as never;
    for (const c of MARKER_CATEGORIES) buckets[c] = new Array(24).fill(0);
    for (const { session } of allSessions) {
      const sessionMarkers = session.markers;
      if (!sessionMarkers) continue;
      const eventTimeById: Record<string, string> = {};
      for (const e of session.events) eventTimeById[e.id] = e.timestamp;
      for (const c of MARKER_CATEGORIES) {
        const catHit: { eventIds: string[] } | undefined = sessionMarkers[c];
        if (!catHit) continue;
        for (const eid of catHit.eventIds) {
          const ts = eventTimeById[eid];
          if (!ts) continue;
          const h = new Date(ts).getHours();
          buckets[c][h] += 1;
        }
      }
    }
    return buckets;
  }, [allSessions]);

  // Find max bucket value for normalization.
  const maxBucket = React.useMemo(() => {
    let m = 0;
    for (const c of MARKER_CATEGORIES) for (const v of hourBuckets[c]) if (v > m) m = v;
    return Math.max(1, m);
  }, [hourBuckets]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      {/* Drawer */}
      <aside className="relative ml-auto h-full w-full max-w-[640px] overflow-y-auto border-l border-line bg-bg-panel shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-bg-panel/95 backdrop-blur px-5 py-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-ink-faint">Analytics</p>
            <h2 className="text-[17px] font-semibold tracking-tight text-ink">Vibes summary</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-line bg-bg-panel p-1.5 text-ink-faint hover:border-line-strong hover:text-ink"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </header>

        <div className="space-y-7 px-5 py-5">
          {/* Per-category totals + top sessions */}
          <section>
            <h3 className="text-[10.5px] uppercase tracking-widest text-ink-faint">By category</h3>
            <div className="mt-2.5 space-y-2">
              {MARKER_CATEGORIES.map((c) => {
                const meta = MARKER_META[c];
                const agg = perCategory[c];
                if (agg.count === 0) return null;
                return (
                  <details key={c} className="group rounded-md border border-line bg-bg-subtle">
                    <summary className="flex cursor-pointer items-center gap-3 px-3 py-2 text-[12.5px]">
                      <span className="text-[14px]">{meta.emoji}</span>
                      <span className="font-medium text-ink">{meta.label}</span>
                      <span className="ml-auto flex items-center gap-3 text-[11.5px] text-ink-faint">
                        <span><span className="text-ink">{agg.count}</span> matches</span>
                        <span><span className="text-ink">{agg.eventCount}</span> events</span>
                      </span>
                    </summary>
                    <div className="space-y-1 border-t border-line px-3 py-2">
                      <p className="text-[10.5px] uppercase tracking-widest text-ink-faint">Top sessions</p>
                      {agg.topSessions.map(({ session, project, count }) => (
                        <Link
                          key={session.id}
                          href={`/session/${session.id}`}
                          className="flex items-center justify-between gap-3 rounded px-2 py-1.5 text-[12px] hover:bg-bg-hover"
                        >
                          <span className="min-w-0 flex-1 truncate text-ink">{session.title}</span>
                          <span className="shrink-0 text-[10.5px] text-ink-faint">{project.name}</span>
                          <span className="shrink-0 text-[11.5px] font-semibold text-accent-glow">{count}</span>
                        </Link>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          </section>

          {/* Per-project heat — small horizontal bar per category */}
          <section>
            <h3 className="text-[10.5px] uppercase tracking-widest text-ink-faint">By project</h3>
            <div className="mt-2.5 space-y-3">
              {perProject.map(({ project, counts, total, sessionCount }) => {
                if (total === 0) return null;
                return (
                  <div key={project.id} className="rounded-md border border-line bg-bg-subtle p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[13px] font-semibold text-ink">{project.name}</p>
                      <p className="text-[10.5px] text-ink-faint">
                        {total} marker{total === 1 ? "" : "s"} across {sessionCount} session{sessionCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full border border-line bg-bg-panel">
                      {MARKER_CATEGORIES.map((c) => {
                        const n = counts[c];
                        if (n === 0) return null;
                        const pct = (n / total) * 100;
                        return (
                          <div
                            key={c}
                            style={{ width: `${pct}%` }}
                            title={`${MARKER_META[c].emoji} ${MARKER_META[c].label}: ${n}`}
                            className={cn(
                              "h-full transition-opacity hover:opacity-80",
                              categoryFill(c)
                            )}
                          />
                        );
                      })}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10.5px] text-ink-muted">
                      {MARKER_CATEGORIES.map((c) => {
                        const n = counts[c];
                        if (n === 0) return null;
                        return (
                          <span key={c} className="inline-flex items-center gap-1">
                            <span>{MARKER_META[c].emoji}</span>
                            <span>{n}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Time-of-day distribution histogram */}
          <section>
            <h3 className="text-[10.5px] uppercase tracking-widest text-ink-faint">By hour of day (stacked)</h3>
            <p className="mt-1 text-[11.5px] text-ink-muted">
              When markers happen across your sessions. Each column is one hour of the day, summed across all sessions.
            </p>
            <div className="mt-3 rounded-md border border-line bg-bg-subtle p-3">
              <div className="flex h-32 items-end gap-[3px]">
                {Array.from({ length: 24 }).map((_, h) => {
                  const total = MARKER_CATEGORIES.reduce((n, c) => n + hourBuckets[c][h], 0);
                  if (total === 0) {
                    return <div key={h} className="flex-1 self-stretch" />;
                  }
                  return (
                    <div
                      key={h}
                      title={`${h}:00 · ${total} markers`}
                      className="flex flex-1 flex-col-reverse"
                    >
                      {MARKER_CATEGORIES.map((c) => {
                        const v = hourBuckets[c][h];
                        if (v === 0) return null;
                        const heightPct = (v / maxBucket) * 100;
                        return (
                          <div
                            key={c}
                            style={{ height: `${heightPct}%` }}
                            className={cn("min-h-[2px] w-full", categoryFill(c))}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              <div className="mt-1 flex justify-between text-[9.5px] text-ink-faint">
                <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
              </div>
            </div>
          </section>

          {/* Legend */}
          <section>
            <div className="flex flex-wrap gap-3 text-[10.5px] text-ink-muted">
              {MARKER_CATEGORIES.map((c) => (
                <span key={c} className="inline-flex items-center gap-1.5">
                  <span className={cn("h-2 w-3 rounded-sm", categoryFill(c))} />
                  <span>{MARKER_META[c].emoji} {MARKER_META[c].label}</span>
                </span>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

/** Per-category fill color for the chart bars. Tailwind-safe class names. */
function categoryFill(c: MarkerCategory): string {
  switch (c) {
    case "frustration": return "bg-rose-500/70";
    case "confusion":   return "bg-amber-400/70";
    case "breakthrough":return "bg-yellow-300/70";
    case "celebration": return "bg-fuchsia-400/70";
    case "regret":      return "bg-orange-500/70";
    case "decision":    return "bg-violet-500/70";
    case "redirect":    return "bg-sky-400/70";
    case "gratitude":   return "bg-emerald-400/70";
    case "question":    return "bg-teal-400/70";
  }
}
