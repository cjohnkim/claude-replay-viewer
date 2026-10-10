import test from "node:test";
import assert from "node:assert/strict";
import { createAchDemo, SCENARIOS } from "../lib/demo/ach-trace";
import { businessStateAt, contextAtEvent, matchesAgent, validateAgentTrace } from "../lib/agent-trace";

for (const scenario of Object.keys(SCENARIOS) as (keyof typeof SCENARIOS)[]) {
  test(`${scenario}: deterministic, valid provenance and JSON round-trip`, () => {
    const a = createAchDemo(scenario);
    assert.deepEqual(a, createAchDemo(scenario));
    assert.deepEqual(validateAgentTrace(a), []);
    assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
    assert.equal(new Set(a.events.map(e => e.id)).size, a.events.length);
  });
}
test("no future knowledge: result is new evidence, not context before the tool call", () => {
  const session = createAchDemo();
  const call = session.events.find(e => e.agent?.tool?.name === "read_settlement_receipt")!;
  assert(!contextAtEvent(session, call).some(e => e.id === "return-receipt-v2"));
  assert.deepEqual(call.agent!.receivedEvidenceIds, ["return-receipt-v2"]);
  const beforeHandoff = session.events.find(e => e.title === "Receive the investigation dossier")!;
  assert(!contextAtEvent(session, beforeHandoff).some(e => e.id === "original-payment-v7"));
  assert(beforeHandoff.agent!.receivedEvidenceIds.includes("original-payment-v7"));
  const beforeExecution = session.events.find(e => e.title === "Deliver the bound authorization and evidence")!;
  assert.deepEqual(contextAtEvent(session, beforeExecution), []);
});
test("early policy waits; separate bound grants precede each financial action", () => {
  const session = createAchDemo();
  const decisions = session.events.filter(e => e.agent?.policy);
  assert.deepEqual(decisions.map(e => e.agent!.policy!.outcome), ["needs_evidence", "allow", "allow"]);
  for (const event of session.events.filter(e => e.agent?.stateChanges?.length)) {
    for (const change of event.agent!.stateChanges!) {
      const decisionIndex = session.events.findIndex(e => e.agent?.policy?.id === change.authorizationId);
      assert(decisionIndex >= 0 && decisionIndex < session.events.indexOf(event));
      assert.equal(session.events[decisionIndex].agent!.policy!.outcome, "allow");
    }
  }
});
test("cursor projection reverses correctly and agent filtering never changes business truth", () => {
  const session = createAchDemo();
  const reopenIndex = session.events.findIndex(e => e.type === "state_change");
  const postingIndex = session.events.findIndex(e => e.type === "ledger_posting");
  assert.equal(businessStateAt(session, reopenIndex - 1).accountStatus, "closed");
  assert.equal(businessStateAt(session, reopenIndex).accountStatus, "return_credit_only");
  assert.equal(businessStateAt(session, postingIndex - 1).customerBalanceMinor, 0);
  const before = businessStateAt(session, postingIndex);
  session.events.filter(e => matchesAgent(e, "evidence-agent"));
  assert.deepEqual(businessStateAt(session, postingIndex), before);
  assert.equal(before.customerBalanceMinor, 480_000);
  assert.equal(before.unallocatedMinor, 0);
  assert.equal(businessStateAt(session, 0).customerBalanceMinor, 0);
  assert.deepEqual(businessStateAt(session, -1), session.agentTrace!.initialState);
});
test("missing receipt and fraud closure retain funds with no reopening or posting", () => {
  for (const scenario of ["missing-evidence", "blocked-account"] as const) {
    const session = createAchDemo(scenario);
    const final = businessStateAt(session, session.events.length - 1);
    assert.equal(final.accountStatus, "closed");
    assert.equal(final.caseStatus, "held");
    assert.equal(final.customerBalanceMinor, 0);
    assert.equal(final.unallocatedMinor, 480_000);
    assert.equal(session.events.filter(e => e.type === "ledger_posting" || e.type === "state_change").length, 0);
  }
});
test("duplicate delivery produces exactly one balanced allocation", () => {
  const session = createAchDemo("duplicate-delivery");
  const ledger = session.events.flatMap(e => e.agent?.ledgerEffects ?? []);
  assert.equal(ledger.length, 1);
  assert.deepEqual(ledger[0].entries.map(e => [e.side, e.amountMinor]), [["debit", 480_000], ["credit", 480_000]]);
  const duplicate = session.events.find(e => e.agent?.tool?.output.duplicate);
  assert(duplicate);
  assert.deepEqual(duplicate.agent!.stateChanges, []);
  assert.equal(businessStateAt(session, 999).customerBalanceMinor, 480_000);
});
test("validator rejects unavailable, future and cross-agent context", () => {
  const session = createAchDemo();
  session.events[0].agent!.contextEvidenceIds.push("posting-receipt");
  assert(validateAgentTrace(session).some(e => e.includes("unknown context")));
  assert(validateAgentTrace(session).some(e => e.includes("future evidence")));
});
test("validator rejects broken causal links, state effects and accounting", () => {
  const session = createAchDemo();
  session.events[1].agent!.causedBy = ["nonexistent"];
  const posting = session.events.find(e => e.type === "ledger_posting")!;
  posting.agent!.stateChanges![0].before = 999;
  posting.agent!.ledgerEffects![0].entries[0].amountMinor = 12;
  const errors = validateAgentTrace(session).join(" ");
  assert.match(errors, /causal reference/);
  assert.match(errors, /state discontinuity/);
  assert.match(errors, /invalid ledger entries/);
});
