import type { AgentEventContext, EvidenceSnapshot, JsonValue } from "../agent-trace";
import type { EventType, ReplayEvent, Session } from "../types";
import { AMOUNT, EXECUTOR, OPERATION_ID, POLICY_ID, POLICY_VERSION, evaluatePolicy, executeAction, initialBankState, type Eligibility } from "./bank-simulator";

export const SCENARIOS = {
  eligible: "Eligible closed account",
  "missing-evidence": "Missing settlement evidence",
  "blocked-account": "Fraud closure · denied",
  "duplicate-delivery": "Duplicate delivery · one posting",
} as const;
export type Scenario = keyof typeof SCENARIOS;
const START = "2026-09-30T13:00:00.000Z";
const CASE_ID = "ACH-SYN-0042";

/** Fixed clock, identities and tool results. Every mutation is produced by the simulator. */
export function createAchDemo(scenario: Scenario = "eligible"): Session {
  let state = initialBankState();
  if (scenario === "blocked-account") state = { ...state, closureReason: "fraud", hold: true };
  const initialState = { ...state };
  const events: ReplayEvent[] = [];
  const evidence: Record<string, EvidenceSnapshot> = {};
  const knowledge = new Map<string, string[]>();
  const now = () => new Date(Date.parse(START) + events.length * 8_000).toISOString();
  const snapshot = (id: string, source: string, version: string, summary: string, data: Record<string, JsonValue>) => {
    evidence[id] = { id, source, version, observedAt: now(), summary, data };
    return id;
  };
  function emit(actorId: string, type: EventType, title: string, description: string,
    fields: Partial<AgentEventContext> = {}, receivedEvidenceIds: string[] = []) {
    const id = `ach-${String(events.length + 1).padStart(2, "0")}`;
    events.push({ id, timestamp: now(), sequenceNumber: events.length + 1, type, title, description,
      agent: { actorId, runId: `${CASE_ID}/${actorId}`, caseId: CASE_ID,
        causedBy: events.length ? [events[events.length - 1].id] : [],
        contextEvidenceIds: [...(knowledge.get(actorId) ?? [])], receivedEvidenceIds, ...fields } });
    knowledge.set(actorId, [...new Set([...(knowledge.get(actorId) ?? []), ...receivedEvidenceIds])]);
    return id;
  }
  function tool(actorId: string, name: string, title: string, description: string,
    input: Record<string, JsonValue>, output: Record<string, JsonValue>, received: string[]) {
    emit(actorId, "tool_call", title, description, { tool: {
      callId: `call-${events.length + 1}`, name, input, output, status: "success",
    } }, received);
  }
  const inbound = snapshot("return-v1", "synthetic/ach-return-feed", "1", "Incoming R02 return · $4,800 · original trace SYN-1029", {
    tenantId: "cedar-demo", caseId: CASE_ID, originalTrace: "SYN-1029", amountMinor: AMOUNT,
    currency: "USD", reason: "R02", receiptConfirmed: false,
    explanation: "Supplier account at receiving bank is closed. Northstar's own Cedar account subsequently closed administratively; these are distinct accounts.",
  });
  tool("investigator", "read_return", "Incoming return requires investigation", "A returned outgoing credit cannot be credited to the now-closed originator account.",
    { caseId: CASE_ID }, { evidenceId: inbound }, [inbound]);
  const account = snapshot("account-v1", "synthetic/account-service", "1", "Northstar account is closed; eligibility has not yet been established", {
    accountId: "account-SYN-NORTHSTAR", status: state.accountStatus, version: 1, balanceMinor: 0,
  });
  tool("investigator", "read_account", "Customer account is closed", "Do not infer permission to reopen from a return notification.",
    { accountId: "account-SYN-NORTHSTAR" }, { evidenceId: account }, [account]);
  const policy = snapshot("policy-demo-1", "synthetic/policy-registry", POLICY_VERSION, "Demo policy permits only an evidenced, restricted return-credit transition", {
    policyId: POLICY_ID, version: POLICY_VERSION, maxAmountMinor: 1_000_000,
    required: ["original debit match", "confirmed return receipt", "administrative closure eligibility", "no holds"],
    scope: "One return; no outgoing payments; no general account reactivation.",
  });
  emit("investigator", "evidence", "Load the bounded handling policy", "This fictional policy is a demo assumption, not an ACH rule or a production control.", {}, [policy]);
  emit("policy-service", "evidence", "Receive the initial evidence packet", "Only the inbound notification, closed-account snapshot and policy have been delivered.", {}, [inbound, account, policy]);
  const incomplete: Eligibility = { originalMatched: false, receiptConfirmed: false, closureEligible: false, evidenceIds: [inbound, account, policy] };
  const preliminary = evaluatePolicy(state, incomplete, "reopen_for_return", now(), "decision-01");
  emit("policy-service", "policy_decision", "Pause: three facts are still missing", "Original debit, confirmed receipt and closure eligibility must be established before any write.", { policy: preliminary });
  emit("evidence-agent", "evidence", "Assign the missing-evidence investigation", "The evidence agent receives the case and policy; it does not automatically share the investigator's memory.", {}, [inbound, policy]);
  const original = snapshot("original-payment-v7", "synthetic/payment-archive", "7", "Exact scoped match to Northstar's original $4,800 debit", {
    tenantId: "cedar-demo", paymentId: "payment-SYN-1029", originalTrace: "SYN-1029", amountMinor: AMOUNT,
    currency: "USD", customerId: "northstar-demo", originalDebitId: "debit-SYN-1029", candidateCount: 1,
  });
  tool("evidence-agent", "lookup_original_debit", "Match the original payment and debit", "Match tenant, trace, amount, currency and customer; a similar name would not be sufficient.",
    { tenantId: "cedar-demo", originalTrace: "SYN-1029" }, { evidenceId: original, candidateCount: 1 }, [original]);
  const receiptPresent = scenario !== "missing-evidence";
  const receipt = snapshot("return-receipt-v2", "synthetic/settlement-ledger", "2", receiptPresent ? "Funds confirmed in unallocated return liability" : "Receipt unavailable; notification remains unconfirmed", {
    confirmed: receiptPresent, amountMinor: AMOUNT, allocationAvailable: true,
    receiptId: receiptPresent ? "receipt-SYN-0042" : null,
  });
  tool("evidence-agent", "read_settlement_receipt", receiptPresent ? "Confirm the funds were received" : "Settlement evidence is unavailable",
    "The receipt is independent evidence of funds received; the return message alone does not prove settlement.",
    { caseId: CASE_ID }, { evidenceId: receipt, confirmed: receiptPresent }, [receipt]);
  const closure = snapshot("closure-review-v3", "synthetic/closure-register", "3", state.hold ? "Fraud closure and active hold prohibit reopening" : "Administrative closure; no hold; restricted return credit is eligible", {
    closureReason: state.closureReason, hold: state.hold, closedAt: "2026-09-28T16:00:00.000Z", reviewed: true,
  });
  tool("evidence-agent", "read_closure_review", "Establish why the customer account closed", "A closed status alone says nothing about eligibility. Retrieve the reason and current restrictions.",
    { accountId: "account-SYN-NORTHSTAR" }, { evidenceId: closure }, [closure]);
  const packet = [inbound, account, policy, original, receipt, closure];
  emit("investigator", "evidence", "Receive the investigation dossier", "The investigator can now see the collected results and their source versions.", {}, [original, receipt, closure]);
  emit("policy-service", "evidence", "Receive evidence for authorization", "The deterministic policy service receives the same exact dossier before making a decision.", {}, [original, receipt, closure]);
  const eligibility: Eligibility = { originalMatched: true, receiptConfirmed: receiptPresent, closureEligible: true, evidenceIds: packet };
  const reopen = evaluatePolicy(state, eligibility, "reopen_for_return", now(), "decision-02");
  emit("policy-service", "policy_decision", reopen.outcome === "allow" ? "Authorize a restricted account-state change" : "Hold the case: policy does not permit a write",
    reopen.outcome === "allow" ? "Grant binds posting-agent, operation, policy version, state version and expiry." : "No account-state change and no posting occur. Review is still required.", { policy: reopen });
  if (reopen.outcome !== "allow") {
    const held = snapshot("held-outcome", "synthetic/policy-service", "1", "Case remains held without financial writes", { outcome: reopen.outcome, decisionId: reopen.id });
    emit("investigator", "evidence", "Receive the held-case outcome", "The investigator receives the explicit non-authorization result.", {}, [held]);
    emit("investigator", "checkpoint", "Review required; funds remain unallocated", "The agent cannot substitute confidence for missing evidence or override a fraud hold.", { stateChanges: [
      { entityId: CASE_ID, field: "caseStatus", before: "investigating", after: "held" },
    ] });
  } else {
    const authorization = snapshot("reopen-grant", "synthetic/policy-service", "1", "Restricted state-change authorization", {
      decisionId: reopen.id, action: reopen.action, expectedVersion: state.version,
      operationId: OPERATION_ID, principalId: EXECUTOR, expiresAt: reopen.grant!.expiresAt,
    });
    emit(EXECUTOR, "evidence", "Deliver the bound authorization and evidence", "Posting-agent receives only the explicitly delivered packet. It has no earlier implicit knowledge.", {}, [...packet, authorization]);
    const reopened = executeAction(state, reopen, eligibility, { action: "reopen_for_return", principalId: EXECUTOR, operationId: OPERATION_ID, now: now() });
    state = reopened.state;
    const reopenedSnapshot = snapshot("account-v2", "synthetic/account-service", "2", "Account now permits this return credit only", {
      status: state.accountStatus, version: state.version, authorizationId: reopen.id,
    });
    emit(EXECUTOR, "state_change", "Reopen for this return credit only", "Current state and permission pass the commit-time checks. Outgoing payments remain disabled.", {
      stateChanges: reopened.changes, tool: { callId: "call-reopen", name: "reopen_for_return", input: { decisionId: reopen.id, expectedVersion: 1, operationId: OPERATION_ID }, output: { status: state.accountStatus, version: state.version }, status: "success" },
    }, [reopenedSnapshot]);
    emit("policy-service", "evidence", "Receive the account-state receipt", "The old account snapshot remains immutable. Version 2 is explicitly delivered for the posting decision.", {}, [reopenedSnapshot]);
    const postingEligibility = { ...eligibility, evidenceIds: [...packet, reopenedSnapshot] };
    const posting = evaluatePolicy(state, postingEligibility, "post_return", now(), "decision-03");
    emit("policy-service", "policy_decision", "Authorize the exact $4,800 allocation", "Re-evaluate against account version 2 and the unconsumed return. The earlier grant cannot authorize a posting.", { policy: posting });
    const postingGrant = snapshot("posting-grant", "synthetic/policy-service", "1", "Posting authorization bound to the updated state", {
      decisionId: posting.id, action: posting.action, expectedVersion: state.version,
      operationId: OPERATION_ID, principalId: EXECUTOR, expiresAt: posting.grant!.expiresAt,
    });
    emit(EXECUTOR, "evidence", "Receive the posting authorization", "The executor now holds a separate action-specific grant.", {}, [postingGrant]);
    const posted = executeAction(state, posting, postingEligibility, { action: "post_return", principalId: EXECUTOR, operationId: OPERATION_ID, now: now() });
    state = posted.state;
    const postedSnapshot = snapshot("posting-receipt", "synthetic/ledger", "1", "$4,800 credited once; unallocated amount cleared", {
      postingId: state.postingId, operationId: OPERATION_ID, customerBalanceMinor: state.customerBalanceMinor,
      unallocatedMinor: state.unallocatedMinor, version: state.version,
    });
    emit(EXECUTOR, "ledger_posting", "Post the return and record the receipt", "Debit unallocated return liability; credit customer deposit liability. The inbound receipt was already recorded, so settlement cash is not moved again.", {
      stateChanges: posted.changes, ledgerEffects: posted.ledger,
      tool: { callId: "call-post", name: "post_return", input: { decisionId: posting.id, operationId: OPERATION_ID, expectedVersion: 2 }, output: { postingId: state.postingId, version: state.version }, status: "success" },
    }, [postedSnapshot]);
    if (scenario === "duplicate-delivery") {
      const duplicate = executeAction(state, posting, postingEligibility, { action: "post_return", principalId: EXECUTOR, operationId: OPERATION_ID, now: now() });
      emit(EXECUTOR, "tool_call", "Suppress a duplicate delivery", "The known operation returns its existing receipt. No second allocation or balance change occurs.", {
        tool: { callId: "call-duplicate", name: "post_return", input: { operationId: OPERATION_ID, decisionId: posting.id }, output: { postingId: duplicate.state.postingId, duplicate: duplicate.duplicate }, status: "success" },
        stateChanges: duplicate.changes, ledgerEffects: duplicate.ledger,
      });
    }
    emit("investigator", "evidence", "Receive the execution receipts", "The investigator only learns the execution outcome when these receipts are delivered.", {}, [reopenedSnapshot, postedSnapshot]);
    emit("investigator", "checkpoint", "Exception resolved with linked evidence", "The return is credited once. Account access remains restricted; any later payout or full reopening is a separate bank process.");
  }
  return {
    id: `ach-demo-${scenario}`, project: { id: "twisp-lens-demo", name: "Twisp Lens", description: "Synthetic bank-agent trace" },
    title: "A closed account. One return. A complete trail.",
    shortDescription: "Three simulated agents investigate and resolve a $4,800 ACH return under a fictional bank policy.",
    tags: ["synthetic", "ACH", "agent trace"], startedAt: START, endedAt: events[events.length - 1].timestamp,
    finalSummary: SCENARIOS[scenario], events, fileChanges: {}, snapshots: {}, checkpoints: {}, filePaths: [],
    agentTrace: { schemaVersion: "1", synthetic: true, caseId: CASE_ID, initialState, evidence, agents: [
      { id: "investigator", name: "Investigator", role: "Owns the exception and gathers the final receipts", kind: "simulated_agent" },
      { id: "evidence-agent", name: "Evidence agent", role: "Retrieves payment, settlement and closure records", kind: "simulated_agent" },
      { id: "policy-service", name: "Policy service", role: "Evaluates fictional deterministic authorization rules", kind: "policy_service" },
      { id: EXECUTOR, name: "Posting agent", role: "Invokes bounded state-change and posting actions", kind: "simulated_agent" },
    ] },
    shippedSummary: { headline: "Synthetic replay only", features: [], files: [], knownGaps: ["No real model, Twisp tenant, bank integration or ACH transmission."] },
  };
}
