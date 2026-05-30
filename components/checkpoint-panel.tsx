import type { Checkpoint, FeatureStatus, Session } from "@/lib/types";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

const statusTone: Record<FeatureStatus, "success" | "accent" | "muted" | "warn"> = {
  shipped: "success",
  in_progress: "accent",
  not_started: "muted",
  changed_later: "warn",
};

const statusLabel: Record<FeatureStatus, string> = {
  shipped: "shipped",
  in_progress: "in progress",
  not_started: "not started",
  changed_later: "changed later",
};

interface Props {
  session: Session;
  checkpoint: Checkpoint | null;
  comparison?: Checkpoint | null;
  label?: string;
}

export function CheckpointPanel({ session, checkpoint, comparison, label }: Props) {
  if (!checkpoint) {
    return (
      <div className="rounded-lg border border-line bg-bg-panel p-3 text-[12px] text-ink-muted">
        <p className="text-[11px] uppercase tracking-widest text-ink-faint">Shipped state</p>
        <p className="mt-2">No checkpoint yet — Claude is still working.</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-line bg-bg-panel">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-ink-faint">{label ?? "Shipped at this moment"}</p>
          <p className="mt-0.5 text-[13px] font-medium text-ink">{checkpoint.label}</p>
        </div>
        <Badge tone="accent">checkpoint</Badge>
      </div>
      <div className="px-3 py-2 text-[12px] leading-relaxed text-ink-muted">
        {checkpoint.shippedStateSummary}
      </div>
      <ul className="divide-y divide-line-subtle border-t border-line">
        {checkpoint.featureState.map((f) => {
          const finalState = comparison?.featureState.find((g) => g.name === f.name);
          const diverged = finalState && finalState.status !== f.status;
          return (
            <li key={f.name} className="px-3 py-2 text-[12px]">
              <div className="flex items-center gap-2">
                <span className="font-medium text-ink">{f.name}</span>
                <Badge tone={statusTone[f.status]} className="ml-auto">{statusLabel[f.status]}</Badge>
              </div>
              <p className="mt-0.5 text-[11.5px] text-ink-muted">{f.description}</p>
              {diverged && finalState && (
                <p className={cn("mt-1 text-[11px]", "text-amber-300/90")}>
                  → final: {statusLabel[finalState.status]}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
