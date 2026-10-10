import type { EvidenceSnapshot } from "./agent-trace";
import type { Session } from "./types";

export interface EvidenceHandoff {
  fromIndex: number;
  toIndex: number;
  evidenceIds: string[];
}

/** Draw only recorded evidence transfers. A serial causal link is not a handoff. */
export function evidenceHandoffs(session: Session): EvidenceHandoff[] {
  const indices = new Map(session.events.map((event, index) => [event.id, index]));
  const edges = new Map<string, EvidenceHandoff>();
  session.events.forEach((event, toIndex) => {
    for (const transfer of event.agent?.evidenceTransfers ?? []) {
      const fromIndex = indices.get(transfer.fromEventId);
      if (fromIndex === undefined || fromIndex >= toIndex) continue;
      const key = `${fromIndex}:${toIndex}`;
      const edge = edges.get(key) ?? { fromIndex, toIndex, evidenceIds: [] };
      edge.evidenceIds.push(transfer.evidenceId);
      edges.set(key, edge);
    }
  });
  return [...edges.values()];
}

export const KNOWLEDGE_CATEGORIES = [
  { id: "return", label: "Return", x: 80, y: 38 },
  { id: "account", label: "Account", x: 230, y: 30 },
  { id: "policy", label: "Policy", x: 380, y: 38 },
  { id: "original", label: "Original debit", x: 390, y: 145 },
  { id: "settlement", label: "Settlement", x: 380, y: 252 },
  { id: "closure", label: "Closure review", x: 230, y: 260 },
  { id: "authorization", label: "Authorizations", x: 80, y: 252 },
  { id: "outcome", label: "Receipts", x: 70, y: 145 },
] as const;
export type KnowledgeCategory = typeof KNOWLEDGE_CATEGORIES[number]["id"];

function categoryOf(snapshot: EvidenceSnapshot): KnowledgeCategory {
  if (snapshot.source.endsWith("ach-return-feed")) return "return";
  if (snapshot.source.endsWith("account-service")) return "account";
  if (snapshot.source.endsWith("policy-registry")) return "policy";
  if (snapshot.source.endsWith("payment-archive")) return "original";
  if (snapshot.source.endsWith("settlement-ledger")) return "settlement";
  if (snapshot.source.endsWith("closure-register")) return "closure";
  if (snapshot.source.endsWith("policy-service") && typeof snapshot.data.action === "string") return "authorization";
  return "outcome";
}

/** The selected event's own context is authoritative. No session-wide accumulation. */
export function knowledgeAt(session: Session, index: number, phase: "before" | "after") {
  const event = session.events[index];
  const before = event?.agent?.contextEvidenceIds ?? [];
  const received = event?.agent?.receivedEvidenceIds ?? [];
  const ids = [...new Set([...before, ...(phase === "after" ? received : [])])];
  return KNOWLEDGE_CATEGORIES.map(category => ({
    ...category,
    snapshots: ids.map(id => session.agentTrace?.evidence[id])
      .filter((s): s is EvidenceSnapshot => !!s && categoryOf(s) === category.id),
    newIds: phase === "after" ? received.filter(id => !before.includes(id) && ids.includes(id) &&
      !!session.agentTrace?.evidence[id] && categoryOf(session.agentTrace.evidence[id]) === category.id) : [],
  }));
}
