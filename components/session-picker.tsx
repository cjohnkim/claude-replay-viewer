"use client";
import * as React from "react";
import Link from "next/link";
import type { Session, Project } from "@/lib/types";
import { GitBranch, Search, ArrowRight, Clock, Files, FlagTriangleRight, Hash, Calendar, Zap, type LucideIcon } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { MARKER_CATEGORIES, MARKER_META, type MarkerCategory } from "@/lib/markers";

interface Props {
  groups: { project: Project; sessions: Session[] }[];
}

export function SessionPicker({ groups }: Props) {
  const [query, setQuery] = React.useState("");
  const [selectedTags, setSelectedTags] = React.useState<Set<string>>(new Set());
  const [selectedMarkers, setSelectedMarkers] = React.useState<Set<MarkerCategory>>(new Set());
  const lower = query.trim().toLowerCase();

  const allTags = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of groups) {
      for (const s of g.sessions) {
        for (const t of s.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [groups]);

  const toggleTag = React.useCallback((t: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }, []);

  const toggleMarker = React.useCallback((m: MarkerCategory) => {
    setSelectedMarkers((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }, []);

  const markerCounts = React.useMemo(() => {
    const out: Record<MarkerCategory, number> = {
      frustration: 0, confusion: 0, breakthrough: 0, celebration: 0, regret: 0,
      decision: 0, redirect: 0, gratitude: 0,
    };
    for (const g of groups) {
      for (const s of g.sessions) {
        for (const c of MARKER_CATEGORIES) {
          if ((s.markers?.[c]?.count ?? 0) > 0) out[c] += 1;
        }
      }
    }
    return out;
  }, [groups]);

  const filteredGroups = groups
    .map((g) => ({
      project: g.project,
      sessions: g.sessions.filter((s) => {
        if (selectedTags.size > 0) {
          const sTags = s.tags ?? [];
          let match = false;
          for (const t of sTags) if (selectedTags.has(t)) { match = true; break; }
          if (!match) return false;
        }
        if (selectedMarkers.size > 0) {
          let any = false;
          for (const m of selectedMarkers) {
            if ((s.markers?.[m]?.count ?? 0) > 0) { any = true; break; }
          }
          if (!any) return false;
        }
        if (!lower) return true;
        // Search also matches marker sample text (so "fuck" or "got it" finds matching sessions).
        const markerHaystack = s.markers
          ? Object.values(s.markers).flatMap((m) => m.samples).join(" ")
          : "";
        const hay = [
          s.title, s.shortDescription, s.project.name, s.project.description,
          ...(s.tags ?? []),
          markerHaystack,
        ].join(" ").toLowerCase();
        return hay.includes(lower);
      }),
    }))
    .filter((g) => g.sessions.length > 0);

  const hasFilters = query.length > 0 || selectedTags.size > 0 || selectedMarkers.size > 0;
  const clearAll = () => { setQuery(""); setSelectedTags(new Set()); setSelectedMarkers(new Set()); };

  const totalSessions = groups.reduce((n, g) => n + g.sessions.length, 0);
  const totalEvents = groups.reduce((n, g) => n + g.sessions.reduce((m, s) => m + s.events.length, 0), 0);

  return (
    <div className="cinematic-bg min-h-screen w-full text-ink">
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-14">
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md border border-accent/40 bg-accent/15">
                <GitBranch size={14} className="text-accent-glow" />
              </div>
              <p className="text-[11px] uppercase tracking-widest text-ink-faint">
                Claude Code · Replay Viewer
              </p>
            </div>
            <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight">
              Previous sessions
            </h1>
            <p className="mt-1 max-w-xl text-[13.5px] text-ink-muted">
              Replay how a feature was built. Each session is one shipping arc — prompts, tool actions, file diffs, snapshots, and checkpoints.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11.5px] text-ink-faint">
            <Stat label="Projects" value={groups.length} />
            <Stat label="Sessions" value={totalSessions} />
            <Stat label="Events" value={totalEvents} />
          </div>
        </header>

        {/* Search */}
        <label className="mt-8 flex items-center gap-2 rounded-lg border border-line bg-bg-panel px-3 py-2 focus-within:border-accent/40">
          <Search size={14} className="text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sessions, projects, tags…"
            className="w-full bg-transparent text-[13px] text-ink placeholder:text-ink-faint focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-[11px] text-ink-faint hover:text-ink">
              clear
            </button>
          )}
        </label>

        {/* Marker facets — sentiment / statement categories */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] uppercase tracking-widest text-ink-faint">Vibes</span>
          {MARKER_CATEGORIES.map((m) => {
            const meta = MARKER_META[m];
            const n = markerCounts[m];
            const active = selectedMarkers.has(m);
            const disabled = n === 0;
            return (
              <button
                key={m}
                type="button"
                onClick={() => !disabled && toggleMarker(m)}
                disabled={disabled}
                title={meta.description}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                  active
                    ? "border-accent/60 bg-accent/15 text-accent-glow"
                    : disabled
                      ? "border-line-subtle bg-bg-panel/40 text-ink-faint opacity-50"
                      : "border-line bg-bg-panel text-ink-muted hover:border-line-strong hover:text-ink"
                )}
              >
                <span>{meta.emoji}</span>
                <span>{meta.label}</span>
                <span className={cn("text-[10px]", active ? "text-accent-glow/70" : "text-ink-faint")}>
                  {n}
                </span>
              </button>
            );
          })}
          {selectedMarkers.size > 0 && (
            <button
              onClick={() => setSelectedMarkers(new Set())}
              className="ml-1 text-[11px] text-ink-faint hover:text-ink"
            >
              clear vibes
            </button>
          )}
        </div>

        {/* Tag facets */}
        {allTags.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] uppercase tracking-widest text-ink-faint">Tags</span>
            {allTags.map(([t, n]) => {
              const active = selectedTags.has(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTag(t)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                    active
                      ? "border-accent/60 bg-accent/15 text-accent-glow"
                      : "border-line bg-bg-panel text-ink-muted hover:border-line-strong hover:text-ink"
                  )}
                >
                  <span>{t}</span>
                  <span className={cn("text-[10px]", active ? "text-accent-glow/70" : "text-ink-faint")}>
                    {n}
                  </span>
                </button>
              );
            })}
            {selectedTags.size > 0 && (
              <button
                onClick={() => setSelectedTags(new Set())}
                className="ml-1 text-[11px] text-ink-faint hover:text-ink"
              >
                clear tags
              </button>
            )}
          </div>
        )}

        {/* Groups */}
        <div className="mt-8 space-y-10">
          {filteredGroups.length === 0 && (
            <div className="rounded-lg border border-line bg-bg-panel px-6 py-12 text-center">
              <p className="text-[13px] text-ink-muted">
                No sessions match the current filters.
              </p>
              {hasFilters && (
                <button
                  onClick={clearAll}
                  className="mt-3 text-[11.5px] text-accent-glow hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
          {filteredGroups.map((g) => (
            <section key={g.project.id}>
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <div>
                  <h2 className="text-[18px] font-semibold tracking-tight text-ink">{g.project.name}</h2>
                  <p className="mt-0.5 text-[12.5px] text-ink-muted">{g.project.description}</p>
                </div>
                <p className="shrink-0 text-[10.5px] uppercase tracking-widest text-ink-faint">
                  {g.sessions.length} session{g.sessions.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {g.sessions.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    selectedTags={selectedTags}
                    onTagClick={toggleTag}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function SessionCard({
  session,
  selectedTags,
  onTagClick,
}: {
  session: Session;
  selectedTags: Set<string>;
  onTagClick: (t: string) => void;
}) {
  const counts = countByType(session);
  const checkpoints = counts["checkpoint"] ?? 0;
  const fileCount = session.filePaths.length;
  const eventCount = session.events.length;
  const duration = formatRelativeTime(session.startedAt, session.endedAt);
  const tokensTotal = session.tokens ? formatTokens(session.tokens.total) : null;
  const tokensBreakdown = session.tokens
    ? `in: ${formatTokens(session.tokens.input)} · cache+: ${formatTokens(session.tokens.cacheCreation)} · cache-r: ${formatTokens(session.tokens.cacheRead)} · out: ${formatTokens(session.tokens.output)} · ${session.tokens.turns} turn${session.tokens.turns === 1 ? "" : "s"}`
    : "";
  const date = new Date(session.startedAt).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <Link
      href={`/session/${session.id}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border border-line bg-bg-panel",
        "transition-all hover:border-accent/40 hover:bg-bg-hover"
      )}
    >
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <h3 className="text-[14px] font-semibold leading-snug text-ink">
          {session.title}
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {tokensTotal && (
            <span
              title={tokensBreakdown}
              className="inline-flex items-center gap-1 rounded-md border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10.5px] font-semibold tracking-wide text-accent-glow"
            >
              <Zap size={10} />
              {tokensTotal}
            </span>
          )}
          <ArrowRight size={15} className="mt-0.5 text-ink-faint transition-colors group-hover:text-accent-glow" />
        </div>
      </div>
      <p className="px-4 text-[12.5px] leading-relaxed text-ink-muted">
        {session.shortDescription}
      </p>
      {session.markers && (
        <div className="flex flex-wrap gap-1 px-4 pt-2.5">
          {MARKER_CATEGORIES.map((c) => {
            const hit = session.markers?.[c];
            if (!hit || hit.count === 0) return null;
            const meta = MARKER_META[c];
            const tooltip = hit.samples.length > 0
              ? `${meta.label}: ${hit.samples.join(", ")}`
              : meta.label;
            return (
              <span
                key={c}
                title={tooltip}
                className="inline-flex items-center gap-1 rounded-md border border-line-subtle bg-bg-subtle/60 px-1.5 py-0.5 text-[10.5px] text-ink-muted"
              >
                <span>{meta.emoji}</span>
                <span className="font-medium text-ink">{hit.count}</span>
              </span>
            );
          })}
        </div>
      )}
      {session.tags && session.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3">
          {session.tags.map((t) => {
            const active = selectedTags.has(t);
            return (
              <button
                key={t}
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTagClick(t); }}
                title={active ? `Remove "${t}" filter` : `Filter by "${t}"`}
                className={cn(
                  "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium tracking-wide transition-colors",
                  active
                    ? "border-accent/60 bg-accent/15 text-accent-glow"
                    : "border-line-subtle bg-bg-panel text-ink-faint hover:border-accent/40 hover:text-ink"
                )}
              >
                {t}
              </button>
            );
          })}
        </div>
      )}
      <div className="mt-3 grid grid-cols-5 divide-x divide-line-subtle border-t border-line">
        <Cell icon={Clock} label="duration" value={duration} />
        <Cell icon={Hash} label="events" value={eventCount} />
        <Cell icon={Files} label="files" value={fileCount} />
        <Cell icon={FlagTriangleRight} label="ckpts" value={checkpoints} />
        <Cell icon={Zap} label="tokens" value={tokensTotal ?? "—"} title={tokensBreakdown || undefined} />
      </div>
      <div className="flex items-center gap-1.5 border-t border-line bg-bg-subtle/40 px-4 py-2 text-[10.5px] text-ink-faint">
        <Calendar size={11} />
        <span>{date}</span>
      </div>
    </Link>
  );
}

function Cell({
  icon: Icon, label, value, title,
}: { icon: LucideIcon; label: string; value: string | number; title?: string }) {
  return (
    <div className="px-3 py-2" title={title}>
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-ink-faint">
        <Icon size={10} />
        {label}
      </p>
      <p className="mt-0.5 text-[13px] font-medium text-ink">{value}</p>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(2).replace(/\.?0+$/, "") + "K";
  if (n < 1_000_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  if (n < 1_000_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  return (n / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "") + "B";
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-line bg-bg-panel px-2.5 py-1.5">
      <p className="text-[9.5px] uppercase tracking-widest text-ink-faint">{label}</p>
      <p className="mt-0.5 text-[13px] font-semibold text-ink">{value}</p>
    </div>
  );
}

function countByType(s: Session): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of s.events) out[e.type] = (out[e.type] ?? 0) + 1;
  return out;
}
