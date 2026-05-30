import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "success" | "danger" | "warn" | "muted";
const tones: Record<Tone, string> = {
  neutral: "bg-bg-subtle text-ink-muted border-line",
  accent:  "bg-accent/15 text-accent-glow border-accent/40",
  success: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  danger:  "bg-red-500/10 text-red-300 border-red-500/30",
  warn:    "bg-amber-500/10 text-amber-300 border-amber-500/30",
  muted:   "bg-bg-panel text-ink-faint border-line-subtle",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium tracking-wide uppercase",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
