"use client";
import * as React from "react";
import type { Session } from "@/lib/types";
import { fileStateAt, latestChangeFor } from "@/lib/replay-state";
import { FileText, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";

interface Props {
  session: Session;
  selectedIndex: number;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
}

export function FileTree({ session, selectedIndex, selectedFile, onSelectFile }: Props) {
  const [search, setSearch] = React.useState("");
  const state = fileStateAt(session, selectedIndex);

  const items = session.filePaths.map((path) => {
    const content = state.get(path);
    const exists = content !== undefined && content !== null;
    const fc = latestChangeFor(session, path, selectedIndex);
    let status: "new" | "edited" | "missing" | "unchanged" = "missing";
    if (exists) {
      if (fc && session.events.findIndex((e) => e.id === fc.eventId) === selectedIndex) {
        status = fc.changeType === "created" ? "new" : "edited";
      } else {
        status = "unchanged";
      }
    }
    return { path, exists, status, lines: typeof content === "string" ? content.split("\n").length : 0 };
  });

  const filtered = items.filter((i) => i.path.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <p className="text-[11px] uppercase tracking-widest text-ink-faint">Files at this moment</p>
        <Badge tone="muted">{items.filter((i) => i.exists).length} present</Badge>
      </div>
      <div className="border-b border-line px-3 py-2">
        <label className="flex items-center gap-2 rounded-md border border-line bg-bg-subtle px-2 py-1.5 focus-within:border-accent/40">
          <Search size={13} className="text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter files…"
            className="w-full bg-transparent text-[12.5px] text-ink placeholder:text-ink-faint focus:outline-none"
          />
        </label>
      </div>
      <ul className="flex-1 overflow-y-auto p-2">
        {filtered.length === 0 && (
          <li className="px-2 py-3 text-[12px] text-ink-faint">No files match.</li>
        )}
        {filtered.map((item) => {
          const isSelected = selectedFile === item.path;
          return (
            <li key={item.path}>
              <button
                onClick={() => onSelectFile(item.path)}
                disabled={!item.exists}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors",
                  isSelected ? "bg-bg-hover ring-1 ring-accent/40 text-ink" : "text-ink-muted hover:bg-bg-subtle hover:text-ink",
                  !item.exists && "opacity-40"
                )}
              >
                <FileText size={13} className="shrink-0 text-ink-faint" />
                <span className="truncate font-mono">{item.path}</span>
                <span className="ml-auto flex shrink-0 items-center gap-1.5">
                  {item.status === "new" && <Badge tone="success">new</Badge>}
                  {item.status === "edited" && <Badge tone="warn">edited</Badge>}
                  {item.exists && item.status === "unchanged" && (
                    <span className="text-[10.5px] text-ink-faint">{item.lines}L</span>
                  )}
                  {!item.exists && <Badge tone="muted">absent</Badge>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
