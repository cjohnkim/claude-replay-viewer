import {
  User,
  Bot,
  Wrench,
  FileEdit,
  Terminal,
  CheckCircle2,
  Image as ImageIcon,
  Flag,
  GitCommit,
  Package,
  type LucideIcon,
} from "lucide-react";
import type { EventType } from "@/lib/types";

const map: Record<EventType, { icon: LucideIcon; color: string; label: string }> = {
  user_prompt:        { icon: User,         color: "text-sky-300",     label: "Prompt" },
  assistant_response: { icon: Bot,          color: "text-accent-glow", label: "Claude" },
  tool_call:          { icon: Wrench,       color: "text-violet-300",  label: "Tool" },
  file_change:        { icon: FileEdit,     color: "text-amber-300",   label: "File" },
  command:            { icon: Terminal,     color: "text-emerald-300", label: "Command" },
  test_result:        { icon: CheckCircle2, color: "text-emerald-300", label: "Test" },
  snapshot:           { icon: ImageIcon,    color: "text-pink-300",    label: "Snapshot" },
  checkpoint:         { icon: Flag,         color: "text-amber-300",   label: "Checkpoint" },
  commit:             { icon: GitCommit,    color: "text-emerald-300", label: "Commit" },
  artifact:           { icon: Package,      color: "text-violet-300",  label: "Artifact" },
};

export function eventMeta(type: EventType) { return map[type]; }

export function EventIcon({ type, className }: { type: EventType; className?: string }) {
  const { icon: Icon, color } = map[type];
  return <Icon className={`${color} ${className ?? ""}`} aria-hidden />;
}
