import type { ReplayEvent, Session } from "./types";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export interface AgentIdentity {
  id: string;
  name: string;
  role: string;
  kind: "simulated_agent" | "policy_service";
}
export interface EvidenceSnapshot {
  id: string;
  source: string;
  version: string;
  observedAt: string;
  summary: string;
  data: Record<string, JsonValue>;
}
export interface PolicyDecision {
  id: string;
  policyId: string;
  policyVersion: string;
  outcome: "allow" | "deny" | "needs_evidence";
  action: string;
  checks: { name: string; passed: boolean; detail: string }[];
  evidenceIds: string[];
  /** A fictional grant bound to one principal, operation and state version. */
  grant?: {
    principalId: string;
    operationId: string;
    expectedVersion: number;
    expiresAt: string;
  };
}
export interface StateChange {
  entityId: string;
  field: string;
  before: JsonValue;
  after: JsonValue;
  authorizationId?: string;
}
export interface LedgerEffect {
  postingId: string;
  operationId: string;
  currency: "USD";
  entries: { account: string; side: "debit" | "credit"; amountMinor: number }[];
}
export interface AgentEventContext {
  actorId: string;
  runId: string;
  caseId: string;
  causedBy: string[];
  /** Evidence supplied BEFORE this event; this is the recorded context, not omniscience. */
  contextEvidenceIds: string[];
  /** Explicit delivery at the end of this event, available on the actor's next action. */
  receivedEvidenceIds: string[];
  tool?: {
    callId: string;
    name: string;
    input: Record<string, JsonValue>;
    output: Record<string, JsonValue>;
    status: "success" | "denied";
  };
  policy?: PolicyDecision;
  stateChanges?: StateChange[];
  ledgerEffects?: LedgerEffect[];
}
export interface AgentTrace {
  schemaVersion: "1";
  synthetic: true;
  caseId: string;
  agents: AgentIdentity[];
  evidence: Record<string, EvidenceSnapshot>;
  initialState: Record<string, JsonValue>;
}

/** Only snapshots actually supplied before the action. Never use latest account data. */
export function contextAtEvent(session: Session, event: ReplayEvent): EvidenceSnapshot[] {
  return (event.agent?.contextEvidenceIds ?? []).map(id => session.agentTrace?.evidence[id])
    .filter((e): e is EvidenceSnapshot => !!e);
}

/** Global business state is independent of transcript/agent filters. Inclusive cursor. */
export function businessStateAt(session: Session, index: number): Record<string, JsonValue> {
  const state = { ...session.agentTrace?.initialState };
  for (const event of session.events.slice(0, Math.max(0, index + 1))) {
    for (const change of event.agent?.stateChanges ?? []) state[change.field] = change.after;
  }
  return state;
}

export function matchesAgent(event: ReplayEvent, actorId: string): boolean {
  return !actorId || event.agent?.actorId === actorId;
}

/** Reject broken provenance and future/other-agent knowledge in generated or imported traces. */
export function validateAgentTrace(session: Session): string[] {
  const errors: string[] = [];
  const trace = session.agentTrace;
  if (!trace) return ["Missing agent trace"];
  const actors = new Set(trace.agents.map(a => a.id));
  const seen = new Set<string>();
  const known = new Map<string, Set<string>>();
  const state = { ...trace.initialState };
  let previousTime = -Infinity;
  session.events.forEach((event, index) => {
    const a = event.agent;
    const time = Date.parse(event.timestamp);
    if (!Number.isFinite(time) || time < previousTime) errors.push(`${event.id}: invalid time order`);
    previousTime = time;
    if (seen.has(event.id)) errors.push(`${event.id}: duplicate event`);
    if (event.sequenceNumber !== index + 1) errors.push(`${event.id}: invalid sequence`);
    if (!a || !actors.has(a.actorId)) { errors.push(`${event.id}: unknown actor`); return; }
    if (a.caseId !== trace.caseId) errors.push(`${event.id}: wrong case`);
    for (const parent of a.causedBy) if (!seen.has(parent)) errors.push(`${event.id}: invalid causal reference`);
    const actorKnown = known.get(a.actorId) ?? new Set<string>();
    for (const id of a.contextEvidenceIds) if (!actorKnown.has(id)) errors.push(`${event.id}: unknown context ${id}`);
    for (const id of [...a.contextEvidenceIds, ...a.receivedEvidenceIds]) {
      const snapshot = trace.evidence[id];
      if (!snapshot || !Number.isFinite(Date.parse(snapshot.observedAt)) || Date.parse(snapshot.observedAt) > time) {
        errors.push(`${event.id}: missing or future evidence ${id}`);
      }
    }
    for (const id of a.policy?.evidenceIds ?? []) {
      if (!a.contextEvidenceIds.includes(id)) errors.push(`${event.id}: policy used unavailable evidence ${id}`);
    }
    for (const change of a.stateChanges ?? []) {
      if (JSON.stringify(state[change.field]) !== JSON.stringify(change.before)) errors.push(`${event.id}: state discontinuity`);
      state[change.field] = change.after;
    }
    for (const ledger of a.ledgerEffects ?? []) {
      const balance = ledger.entries.reduce((n, e) => n + (e.side === "debit" ? e.amountMinor : -e.amountMinor), 0);
      if (balance !== 0 || ledger.entries.some(e => !Number.isSafeInteger(e.amountMinor) || e.amountMinor <= 0)) {
        errors.push(`${event.id}: invalid ledger entries`);
      }
    }
    a.receivedEvidenceIds.forEach(id => actorKnown.add(id));
    known.set(a.actorId, actorKnown);
    seen.add(event.id);
  });
  return errors;
}
