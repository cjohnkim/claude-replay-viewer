import { notFound } from "next/navigation";
import { ReplayViewer } from "@/components/replay-viewer";
import { getSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: { id: string } }) {
  const session = await getSession(params.id);
  if (!session) notFound();
  return <ReplayViewer session={session} />;
}
