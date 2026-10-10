import test from "node:test";
import assert from "node:assert/strict";
import { initialBankState, evaluatePolicy, executeAction, EXECUTOR, OPERATION_ID, type Eligibility } from "../lib/demo/bank-simulator";
const now = "2026-09-30T13:00:00.000Z";
const evidence: Eligibility = { originalMatched: true, receiptConfirmed: true, closureEligible: true, evidenceIds: ["match-v1", "receipt-v2", "closure-v3"] };
const request = { action: "reopen_for_return" as const, principalId: EXECUTOR, operationId: OPERATION_ID, now };
function setup() {
  const state = initialBankState();
  const decision = evaluatePolicy(state, evidence, "reopen_for_return", now, "allow-1");
  return { state, decision };
}
test("authorization and execution are pure; action does not mutate original state", () => {
  const { state, decision } = setup();
  const result = executeAction(state, decision, evidence, request);
  assert.equal(result.state.accountStatus, "return_credit_only");
  assert.equal(result.state.version, 2);
  assert.equal(state.accountStatus, "closed");
  assert.equal(result.ledger.length, 0);
});
for (const [name, patch] of [
  ["wrong principal", { principalId: "investigator" }],
  ["wrong operation", { operationId: "another-return" }],
  ["permission revoked", { permissionActive: false }],
  ["wrong action", { action: "post_return" as const }],
  ["expired grant", { now: "2026-09-30T13:02:00.000Z" }],
  ["invalid clock", { now: "invalid" }],
] as const) test(`rejects ${name}`, () => {
  const { state, decision } = setup();
  assert.throws(() => executeAction(state, decision, evidence, { ...request, ...patch }));
});
test("rejects stale state; consumed state cannot accept a concurrent repeated write", () => {
  const { state, decision } = setup();
  const first = executeAction(state, decision, evidence, request);
  assert.throws(() => executeAction(first.state, decision, evidence, request), /Stale/);
});
test("rechecks holds, evidence and available amount at commit time", () => {
  const { state, decision } = setup();
  assert.throws(() => executeAction({ ...state, hold: true }, decision, evidence, request), /policy denied/);
  assert.throws(() => executeAction({ ...state, unallocatedMinor: 0 }, decision, evidence, request), /policy denied/);
  assert.throws(() => executeAction(state, decision, { ...evidence, receiptConfirmed: false }, request), /policy denied/);
  assert.throws(() => executeAction(state, decision, { ...evidence, originalMatched: false }, request), /policy denied/);
  assert.throws(() => executeAction(state, decision, { ...evidence, evidenceIds: ["changed"] }, request), /policy denied/);
});
test("old policy and non-authorizing decisions are rejected", () => {
  const { state, decision } = setup();
  assert.throws(() => executeAction(state, { ...decision, policyVersion: "obsolete" }, evidence, request));
  assert.throws(() => executeAction(state, { ...decision, outcome: "deny" }, evidence, request));
});
test("post requires a fresh grant; duplicate returns existing receipt with no effects", () => {
  const { state, decision } = setup();
  const reopened = executeAction(state, decision, evidence, request).state;
  const posting = evaluatePolicy(reopened, evidence, "post_return", now, "allow-2");
  const postRequest = { ...request, action: "post_return" as const };
  const first = executeAction(reopened, posting, evidence, postRequest);
  assert.equal(first.changes.find(c => c.field === "caseStatus")!.entityId, "ACH-SYN-0042");
  assert.equal(first.changes.find(c => c.field === "unallocatedMinor")!.entityId, "return-SYN-0042");
  const retry = executeAction(first.state, posting, evidence, postRequest);
  assert.equal(retry.state.postingId, first.state.postingId);
  assert.equal(retry.duplicate, true);
  assert.deepEqual(retry.changes, []);
  assert.deepEqual(retry.ledger, []);
  assert.equal(retry.state.customerBalanceMinor, 480_000);
});
