import test from "node:test";
import assert from "node:assert/strict";
import { createAchDemo, SCENARIOS } from "../lib/demo/ach-trace";
import { evidenceHandoffs, knowledgeAt } from "../lib/trace-visualization";
import { validateAgentTrace } from "../lib/agent-trace";

for (const scenario of Object.keys(SCENARIOS) as (keyof typeof SCENARIOS)[]) {
  test(`${scenario}: visual handoffs have explicit earlier source records`, () => {
    const session = createAchDemo(scenario);
    const edges = evidenceHandoffs(session);
    assert(edges.length > 0);
    assert.deepEqual(validateAgentTrace(session), []);
    for (const edge of edges) {
      assert(edge.fromIndex < edge.toIndex);
      const from = session.events[edge.fromIndex].agent!;
      const to = session.events[edge.toIndex].agent!;
      assert.notEqual(from.actorId, to.actorId);
      for (const id of edge.evidenceIds) {
        assert(to.receivedEvidenceIds.includes(id));
        assert(to.evidenceTransfers!.some(t => t.evidenceId === id && t.fromEventId === session.events[edge.fromIndex].id));
      }
    }
  });
}
test("causal sequence alone never creates a visual evidence handoff", () => {
  const session = createAchDemo();
  for (const event of session.events) delete event.agent!.evidenceTransfers;
  assert.deepEqual(evidenceHandoffs(session), []);
});
test("assignment comes from the investigator, not the intervening policy service", () => {
  const session = createAchDemo();
  const assignmentIndex = session.events.findIndex(e => e.title === "Assign the missing-evidence investigation");
  const senders = evidenceHandoffs(session).filter(e => e.toIndex === assignmentIndex)
    .map(e => session.events[e.fromIndex].agent!.actorId);
  assert(senders.length > 0);
  assert(senders.every(id => id === "investigator"));
});
test("knowledge phases preserve history and show new evidence only after receipt", () => {
  const session = createAchDemo();
  assert.equal(knowledgeAt(session, 0, "before").flatMap(b => b.snapshots).length, 0);
  assert.deepEqual(knowledgeAt(session, 0, "after").flatMap(b => b.snapshots).map(s => s.id), ["return-v1"]);
  const receiptIndex = session.events.findIndex(e => e.agent?.tool?.name === "read_settlement_receipt");
  assert.equal(knowledgeAt(session, receiptIndex, "before").find(b => b.id === "settlement")!.snapshots.length, 0);
  assert.deepEqual(knowledgeAt(session, receiptIndex, "after").find(b => b.id === "settlement")!.newIds, ["return-receipt-v2"]);
  const grantIndex = session.events.findIndex(e => e.title === "Deliver the bound authorization and evidence");
  assert.equal(knowledgeAt(session, grantIndex, "before").flatMap(b => b.snapshots).length, 0);
  const after = knowledgeAt(session, grantIndex, "after");
  assert.equal(after.find(b => b.id === "authorization")!.snapshots.length, 1);
  assert(!after.flatMap(b => b.snapshots).some(s => s.id === "posting-receipt"));
  assert.equal(knowledgeAt(session, receiptIndex, "before").find(b => b.id === "settlement")!.snapshots.length, 0);
});
test("validator rejects fabricated transfer provenance", () => {
  const session = createAchDemo();
  session.events[3].agent!.evidenceTransfers![0].fromEventId = session.events[session.events.length - 1].id;
  assert(validateAgentTrace(session).some(e => e.includes("invalid evidence transfer")));
});
