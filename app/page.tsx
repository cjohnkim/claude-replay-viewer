import Link from "next/link";
import { SessionPicker } from "@/components/session-picker";
import { groupByProject } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export default async function Page() {
  const groups = await groupByProject();
  return <>
    <div className="border-b border-line bg-bg-panel px-5 py-3 text-xs text-ink-muted">
      <Link href="/demo/ach" className="text-accent-glow hover:underline">Explore the Twisp Lens ACH demo →</Link>
      <span className="ml-3">Synthetic agents, evidence, policy decisions and ledger effects</span>
    </div>
    <SessionPicker groups={groups} />
  </>;
}
