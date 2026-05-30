"use client";
import * as React from "react";
import type { Session } from "@/lib/types";
import { fileStateAt, latestChangeFor } from "@/lib/replay-state";
import { diffLines, diffStats, type DiffLine } from "@/lib/diff";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  session: Session;
  selectedIndex: number;
  selectedFile: string | null;
  compareToFinal: boolean;
}

export function DiffViewer({ session, selectedIndex, selectedFile, compareToFinal }: Props) {
  const [mode, setMode] = React.useState<"step" | "file">("step");

  if (!selectedFile) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="text-[12.5px] text-ink-faint">
          Select a file to see how it changed.
        </p>
      </div>
    );
  }

  const stateNow = fileStateAt(session, selectedIndex);
  const current = stateNow.get(selectedFile) ?? null;
  const fc = latestChangeFor(session, selectedFile, selectedIndex);
  const finalState = fileStateAt(session, session.events.length - 1);
  const finalContent = finalState.get(selectedFile) ?? null;

  let before: string | null;
  let after: string | null;
  let title: string;

  if (compareToFinal) {
    before = current;
    after = finalContent;
    title = "Now → Final";
  } else if (mode === "step" && fc) {
    before = fc.beforeContent;
    after = fc.afterContent;
    title = `Step diff · ${fc.changeType}`;
  } else {
    before = null;
    after = current;
    title = "Current contents";
  }

  const lines = diffLines(before, after);
  const stats = diffStats(lines);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-medium text-ink">{selectedFile}</p>
          <p className="text-[10.5px] text-ink-faint">{title}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {!compareToFinal && fc && (
            <div className="flex rounded-md border border-line bg-bg-subtle p-0.5 text-[11px]">
              <button
                onClick={() => setMode("step")}
                className={cn("rounded px-2 py-0.5", mode === "step" ? "bg-bg-hover text-ink" : "text-ink-muted hover:text-ink")}
              >
                step
              </button>
              <button
                onClick={() => setMode("file")}
                className={cn("rounded px-2 py-0.5", mode === "file" ? "bg-bg-hover text-ink" : "text-ink-muted hover:text-ink")}
              >
                file
              </button>
            </div>
          )}
          {stats.adds + stats.dels > 0 && (
            <>
              <Badge tone="success">+{stats.adds}</Badge>
              <Badge tone="danger">−{stats.dels}</Badge>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full font-mono text-[11.5px] leading-[1.55]">
          <tbody>
            {lines.length === 0 && (
              <tr><td className="p-4 text-center text-ink-faint">No content.</td></tr>
            )}
            {lines.map((l, i) => <DiffRow key={i} line={l} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DiffRow({ line }: { line: DiffLine }) {
  if (line.kind === "ctx") {
    return (
      <tr className="hover:bg-bg-subtle/40">
        <td className="select-none border-r border-line-subtle px-2 text-right text-ink-faint w-10">{line.leftNo}</td>
        <td className="select-none border-r border-line-subtle px-2 text-right text-ink-faint w-10">{line.rightNo}</td>
        <td className="whitespace-pre px-3 text-ink-muted">{line.left || " "}</td>
      </tr>
    );
  }
  if (line.kind === "add") {
    return (
      <tr className="bg-diff-add/40">
        <td className="select-none border-r border-line-subtle px-2 text-right text-ink-faint w-10"></td>
        <td className="select-none border-r border-line-subtle px-2 text-right text-diff-addText w-10">{line.rightNo}</td>
        <td className="whitespace-pre px-3 text-diff-addText">+ {line.right || " "}</td>
      </tr>
    );
  }
  return (
    <tr className="bg-diff-del/40">
      <td className="select-none border-r border-line-subtle px-2 text-right text-diff-delText w-10">{line.leftNo}</td>
      <td className="select-none border-r border-line-subtle px-2 text-right text-ink-faint w-10"></td>
      <td className="whitespace-pre px-3 text-diff-delText">− {line.left || " "}</td>
    </tr>
  );
}
