import type { LedgerEffect, PolicyDecision, StateChange } from "../agent-trace";

/** Fictional policy and in-memory adapter. No real bank or Twisp API is called. */
export const POLICY_ID = "cedar.closed-return";
export const POLICY_VERSION = "demo-1";
export const OPERATION_ID = "resolve-return-SYN-0042";
export const AMOUNT = 480_000; // USD minor units; never use floating-point amounts.
export const EXECUTOR = "posting-agent";
export type Action = "reopen_for_return" | "post_return";
export interface BankState {
  accountStatus: "closed" | "return_credit_only";
  version: number;
  closureReason: "administrative" | "fraud";
  hold: boolean;
  unallocatedMinor: number;
  customerBalanceMinor: number;
  caseStatus: "investigating" | "resolved";
  postingId: string | null;
  completedOperationId: string | null;
}
export interface Eligibility {
  originalMatched: boolean;
  receiptConfirmed: boolean;
  closureEligible: boolean;
  evidenceIds: string[];
}
export function initialBankState(): BankState {
  return {
    accountStatus: "closed", version: 1, closureReason: "administrative", hold: false,
    unallocatedMinor: AMOUNT, customerBalanceMinor: 0, caseStatus: "investigating",
    postingId: null, completedOperationId: null,
  };
}
export function evaluatePolicy(
  state: BankState, evidence: Eligibility, action: Action, now: string, decisionId: string,
  principalId = EXECUTOR,
): PolicyDecision {
  const checks = [
    { name: "Scoped original payment match", passed: evidence.originalMatched, detail: "Tenant, original trace, amount and customer must match the original debit." },
    { name: "Return funds received", passed: evidence.receiptConfirmed, detail: "A confirmed settlement receipt is required; a notification alone is insufficient." },
    { name: "Closure eligibility", passed: evidence.closureEligible && state.closureReason === "administrative" && !state.hold, detail: "Fictional administrative-closure eligibility; no fraud closure or unresolved hold." },
    { name: "Restricted principal", passed: principalId === EXECUTOR, detail: "Only posting-agent can invoke these demo actions." },
    { name: "Exact available amount", passed: state.unallocatedMinor === AMOUNT && !state.postingId, detail: "Exactly $4,800 remains unallocated; no earlier credit." },
    { name: "Expected account state", passed: state.accountStatus === (action === "reopen_for_return" ? "closed" : "return_credit_only"), detail: action === "reopen_for_return" ? "Closed → return-credit-only; no payment origination." : "Only a return-credit-only account can receive this allocation." },
  ];
  const missing = !evidence.originalMatched || !evidence.receiptConfirmed || !evidence.closureEligible;
  const outcome = checks.every(c => c.passed) ? "allow" : missing ? "needs_evidence" : "deny";
  return {
    id: decisionId, policyId: POLICY_ID, policyVersion: POLICY_VERSION, action, outcome,
    evidenceIds: [...evidence.evidenceIds], checks,
    ...(outcome === "allow" ? { grant: {
      principalId, operationId: OPERATION_ID, expectedVersion: state.version,
      expiresAt: new Date(Date.parse(now) + 120_000).toISOString(),
    } } : {}),
  };
}
export interface ExecutionResult {
  state: BankState;
  changes: StateChange[];
  ledger: LedgerEffect[];
  duplicate: boolean;
}
/** Pure compare-and-set simulator. Current state and permission are checked again at commit. */
export function executeAction(
  state: BankState, decision: PolicyDecision, evidence: Eligibility,
  request: { action: Action; principalId: string; operationId: string; now: string; permissionActive?: boolean },
): ExecutionResult {
  const grant = decision.grant;
  if (request.permissionActive === false || request.principalId !== EXECUTOR || !grant ||
      decision.outcome !== "allow" || decision.action !== request.action ||
      decision.policyId !== POLICY_ID || decision.policyVersion !== POLICY_VERSION ||
      grant.principalId !== request.principalId || grant.operationId !== request.operationId ||
      request.operationId !== OPERATION_ID) throw new Error("Authorization denied");
  if (!Number.isFinite(Date.parse(request.now)) || !Number.isFinite(Date.parse(grant.expiresAt)) ||
      Date.parse(request.now) >= Date.parse(grant.expiresAt)) throw new Error("Authorization expired");
  // A known committed operation returns its existing receipt, without another write.
  if (request.action === "post_return" && state.completedOperationId === request.operationId && state.postingId) {
    return { state: { ...state }, changes: [], ledger: [], duplicate: true };
  }
  if (state.version !== grant.expectedVersion) throw new Error("Stale state version");
  const current = evaluatePolicy(state, evidence, request.action, request.now, "commit-check", request.principalId);
  if (current.outcome !== "allow" || JSON.stringify(evidence.evidenceIds) !== JSON.stringify(decision.evidenceIds)) {
    throw new Error("Commit-time policy denied");
  }
  const next: BankState = request.action === "reopen_for_return"
    ? { ...state, accountStatus: "return_credit_only", version: state.version + 1 }
    : { ...state, unallocatedMinor: 0, customerBalanceMinor: AMOUNT, caseStatus: "resolved",
      postingId: "posting-SYN-0042", completedOperationId: request.operationId, version: state.version + 1 };
  const changes: StateChange[] = (Object.keys(next) as (keyof BankState)[])
    .filter(key => next[key] !== state[key])
    .map(key => ({
      entityId: key === "unallocatedMinor" ? "return-SYN-0042"
        : ["caseStatus", "postingId", "completedOperationId"].includes(key) ? "ACH-SYN-0042" : "account-SYN-NORTHSTAR",
      field: key, before: state[key], after: next[key], authorizationId: decision.id,
    }));
  const ledger: LedgerEffect[] = request.action === "post_return" ? [{
    postingId: next.postingId!, operationId: request.operationId, currency: "USD",
    entries: [
      { account: "Unallocated return liability", side: "debit", amountMinor: AMOUNT },
      { account: "Northstar deposit liability", side: "credit", amountMinor: AMOUNT },
    ],
  }] : [];
  return { state: next, changes, ledger, duplicate: false };
}
