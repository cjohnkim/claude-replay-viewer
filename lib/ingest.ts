// Real Claude Code JSONL ingestion.
// Reads ~/.claude/projects/<encoded-cwd>/<session-uuid>.jsonl and maps each
// session into the viewer's Session shape. The cwd encoded in the directory
// name is lossy (project names with dashes are ambiguous), so we prefer the
// authoritative `cwd` field present on JSONL events.

import { readdir, readFile } from "fs/promises";
import { join, basename } from "path";
import { homedir } from "os";
import type {
  Session, Project, ReplayEvent, EventType,
} from "./types";
import { scoreMarkers, MARKER_CATEGORIES, type MarkerCategory } from "./markers";

const ROOT = join(homedir(), ".claude", "projects");

interface RawLine {
  type?: string;
  uuid?: string;
  parentUuid?: string | null;
  timestamp?: string;
  cwd?: string;
  sessionId?: string;
  gitBranch?: string;
  message?: {
    role?: "user" | "assistant";
    content?: string | RawContentBlock[];
    usage?: RawUsage;
  };
}

interface RawUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

type RawContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking?: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content?: unknown; is_error?: boolean };

export async function loadAllSessions(): Promise<Session[]> {
  let dirs;
  try {
    dirs = await readdir(ROOT, { withFileTypes: true });
  } catch {
    return [];
  }

  const out: Session[] = [];
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const projDir = join(ROOT, d.name);
    let files: string[];
    try {
      files = await readdir(projDir);
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith(".jsonl")) continue;
      try {
        const text = await readFile(join(projDir, f), "utf8");
        const session = parseSession(text, d.name, f.replace(/\.jsonl$/, ""));
        if (session) out.push(session);
      } catch {
        // skip unreadable files
      }
    }
  }

  return out.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

function parseSession(text: string, dirName: string, sessionId: string): Session | null {
  const lines = text.split("\n");
  const raw: RawLine[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    try {
      raw.push(JSON.parse(t));
    } catch {
      // skip malformed line
    }
  }
  if (raw.length === 0) return null;

  // Resolve cwd from any event that has it; fall back to decoded dir name.
  const cwd = raw.find((r) => r.cwd)?.cwd ?? decodeDirName(dirName);
  const projectName = basename(cwd) || cwd;
  const project: Project = {
    id: dirName,
    name: projectName,
    description: cwd,
  };

  const events: ReplayEvent[] = [];
  const filePaths = new Set<string>();
  let firstPrompt = "";
  let seq = 0;
  const tokens = {
    input: 0,
    cacheCreation: 0,
    cacheRead: 0,
    output: 0,
    total: 0,
    turns: 0,
  };
  const markers: Record<string, { count: number; eventIds: string[]; samples: string[] }> = {};
  for (const c of MARKER_CATEGORIES) markers[c] = { count: 0, eventIds: [], samples: [] };

  for (const r of raw) {
    const ts = r.timestamp ?? "";
    const uuid = r.uuid ?? `${sessionId}-${seq}`;

    const usage = r.message?.usage;
    if (r.type === "assistant" && usage) {
      tokens.input += usage.input_tokens ?? 0;
      tokens.cacheCreation += usage.cache_creation_input_tokens ?? 0;
      tokens.cacheRead += usage.cache_read_input_tokens ?? 0;
      tokens.output += usage.output_tokens ?? 0;
      tokens.turns += 1;
    }

    if (r.type === "user") {
      const content = r.message?.content;
      if (typeof content === "string") {
        const text = stripSlashCommandNoise(content);
        if (!text) continue;
        if (!firstPrompt) firstPrompt = text;
        // Score sentiment/statement markers on the user-prompt text only.
        const hits = scoreMarkers(text);
        for (const cat of MARKER_CATEGORIES) {
          const h = hits[cat];
          if (h.count > 0) {
            markers[cat].count += h.count;
            if (!markers[cat].eventIds.includes(uuid)) markers[cat].eventIds.push(uuid);
            for (const s of h.samples) {
              if (markers[cat].samples.length < 6 && !markers[cat].samples.includes(s)) {
                markers[cat].samples.push(s);
              }
            }
          }
        }
        events.push({
          id: uuid,
          timestamp: ts,
          sequenceNumber: seq++,
          type: "user_prompt",
          title: firstLine(text, 80),
          content: text,
        });
      }
      // user messages that are tool_result arrays are intentionally skipped;
      // they're already represented by the preceding assistant tool_call.
      continue;
    }

    if (r.type === "assistant" && Array.isArray(r.message?.content)) {
      const blocks = r.message!.content as RawContentBlock[];
      let blockIdx = 0;
      for (const b of blocks) {
        const id = `${uuid}-${blockIdx++}`;
        if (b.type === "text" && b.text.trim()) {
          events.push({
            id,
            timestamp: ts,
            sequenceNumber: seq++,
            type: "assistant_response",
            title: firstLine(b.text, 80),
            content: b.text,
          });
        } else if (b.type === "tool_use") {
          const filePath = pickFilePath(b.input);
          if (filePath) filePaths.add(filePath);
          events.push({
            id,
            timestamp: ts,
            sequenceNumber: seq++,
            type: toolEventType(b.name),
            title: `${b.name}${filePath ? `: ${basename(filePath)}` : ""}`,
            description: summarizeToolInput(b.name, b.input),
            content: prettyJSON(b.input),
            relatedFilePaths: filePath ? [filePath] : undefined,
            metadata: { tool: b.name },
          });
        }
        // thinking blocks intentionally skipped — internal chain of thought
      }
      continue;
    }
    // file-history-snapshot, permission-mode, etc. are ignored for v1.
  }

  if (events.length === 0) return null;

  const startedAt = events[0].timestamp || raw[0].timestamp || new Date().toISOString();
  const endedAt =
    events[events.length - 1].timestamp ||
    raw[raw.length - 1].timestamp ||
    startedAt;

  const title = firstPrompt
    ? firstLine(firstPrompt, 90)
    : `Session ${sessionId.slice(0, 8)}`;
  const shortDescription = firstPrompt
    ? truncate(firstPrompt, 200)
    : `Recorded session in ${projectName}`;

  tokens.total = tokens.input + tokens.cacheCreation + tokens.cacheRead + tokens.output;

  const hasAnyMarker = MARKER_CATEGORIES.some((c) => markers[c].count > 0);

  return {
    id: sessionId,
    project,
    title,
    shortDescription,
    tags: [],
    startedAt,
    endedAt,
    finalSummary: `Real Claude Code session • ${events.length} events • ${filePaths.size} files touched`,
    events,
    fileChanges: {},
    snapshots: {},
    checkpoints: {},
    filePaths: [...filePaths].sort(),
    tokens: tokens.turns > 0 ? tokens : undefined,
    markers: hasAnyMarker ? markers : undefined,
    shippedSummary: {
      headline: title,
      features: [],
      files: [...filePaths].sort(),
      knownGaps: [],
    },
  };
}

function decodeDirName(name: string): string {
  // Best-effort: "-Users-chulhojkim-foo" → "/Users/chulhojkim/foo"
  // Ambiguous for cwds with dashes in directory names; cwd from JSONL is preferred.
  return name.replace(/^-/, "/").replace(/-/g, "/");
}

function firstLine(s: string, max: number): string {
  const line = s.split("\n").find((l) => l.trim()) ?? s;
  return truncate(line.trim(), max);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

function pickFilePath(input: Record<string, unknown>): string | undefined {
  const v = input["file_path"] ?? input["path"] ?? input["notebook_path"];
  return typeof v === "string" ? v : undefined;
}

function toolEventType(name: string): EventType {
  if (name === "Bash") return "command";
  if (name === "Write" || name === "Edit" || name === "MultiEdit" || name === "NotebookEdit") {
    return "file_change";
  }
  return "tool_call";
}

function summarizeToolInput(name: string, input: Record<string, unknown>): string {
  if (name === "Bash" && typeof input.command === "string") {
    return truncate(input.command, 120);
  }
  if (typeof input.description === "string") {
    return truncate(input.description, 120);
  }
  const fp = pickFilePath(input);
  if (fp) return fp;
  return "";
}

function prettyJSON(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function stripSlashCommandNoise(s: string): string {
  // Slash command invocations are wrapped in <command-name>...</command-name>
  // tags by the CLI. Strip the wrapper but keep the args.
  if (!s.includes("<command-")) return s;
  const m = s.match(/<command-args>([\s\S]*?)<\/command-args>/);
  const name = s.match(/<command-name>([\s\S]*?)<\/command-name>/)?.[1] ?? "";
  if (m) return `${name} ${m[1]}`.trim();
  return name || s;
}
