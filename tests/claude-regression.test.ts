import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseSession, loadAllSessions } from "../lib/ingest";
import { fileStateAt, finalFileState, nextEventOfTypes, prevEventOfTypes } from "../lib/replay-state";
import { bunnyMazeSession } from "../lib/sessions/bunny-maze";

test("Claude JSONL still ingests prompts, tools, token usage and markers", async () => {
  const path = join(process.cwd(), "tests/fixtures/claude/synthetic-project/claude-regression.jsonl");
  const text = await readFile(path, "utf8");
  const session = parseSession(text + "\nmalformed-json\n", "synthetic-project", "claude-regression")!;
  assert.equal(session.title, "How do I add a hello page?");
  assert.equal(session.project.name, "claude-regression");
  assert.deepEqual(session.events.map(e => e.type), ["user_prompt", "assistant_response", "file_change", "command", "assistant_response"]);
  assert.equal(session.events[3].metadata?.tool, "Bash");
  assert.deepEqual(session.filePaths, ["/synthetic/hello.ts"]);
  assert.equal(session.tokens!.total, 100);
  assert.equal(session.markers!.question.count, 1);
  assert.equal(session.agentTrace, undefined);
  assert(!JSON.stringify(session).includes("SYNTHETIC_PRIVATE_THINKING"));
});
test("file discovery works in an isolated data root and tolerates absent roots", async () => {
  const sessions = await loadAllSessions(join(process.cwd(), "tests/fixtures/claude"));
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].id, "claude-regression");
  assert.deepEqual(await loadAllSessions(join(process.cwd(), "tests/nonexistent")), []);
  assert.equal(parseSession("\ninvalid\n", "test", "empty"), null);
});
test("existing coding-session file reconstruction and chronological navigation remain intact", () => {
  const session = bunnyMazeSession;
  assert.equal(fileStateAt(session, -1).size, 0);
  assert(finalFileState(session).size > 0);
  const next = nextEventOfTypes(session, 0, ["tool_call"]);
  assert(next > 0);
  assert.equal(session.events[next].type, "tool_call");
  assert.equal(fileStateAt(session, next).get(session.fileChanges.fc_create.filePath), session.fileChanges.fc_create.afterContent);
  assert.equal(prevEventOfTypes(session, next, ["user_prompt"]), 0);
  assert.equal(nextEventOfTypes(session, session.events.length - 1, ["file_change"]), -1);
});
