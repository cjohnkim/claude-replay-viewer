import { SessionPicker } from "@/components/session-picker";
import { groupByProject } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export default async function Page() {
  const groups = await groupByProject();
  return <SessionPicker groups={groups} />;
}
