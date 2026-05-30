import type {
  Session, ReplayEvent, FileChange, Snapshot, Checkpoint, FeatureState, Project,
} from "../types";

const project: Project = {
  id: "loop-crm",
  name: "Loop CRM",
  description: "Lightweight CRM for SMBs. Pipeline + contacts + email sync. Strong product opinion about not becoming Salesforce.",
};

// --- File fixtures ---

const PARSER_V1 = `// lib/csv-parser.ts
import Papa from "papaparse";

export interface ContactRow {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export function parseContactsCsv(text: string): ContactRow[] {
  const { data, errors } = Papa.parse<ContactRow>(text, { header: true, skipEmptyLines: true });
  if (errors.length) throw new Error(errors[0].message);
  return data
    .filter((r) => r.email && /.+@.+\\..+/.test(r.email))
    .map((r) => ({
      email: r.email.trim().toLowerCase(),
      firstName: r.firstName?.trim(),
      lastName: r.lastName?.trim(),
      phone: r.phone?.replace(/[^0-9+]/g, ""),
    }));
}

export function dedupe(rows: ContactRow[]): ContactRow[] {
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.email) ? false : (seen.add(r.email), true)));
}
`;

const PARSER_V2 = `// lib/csv-parser.ts — streaming, backpressure-aware
import Papa from "papaparse";

export interface ContactRow {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

const CHUNK = 500;

export async function* streamContactsCsv(
  file: File,
  onProgress?: (pct: number) => void,
): AsyncGenerator<ContactRow[]> {
  const reader = file.stream().getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let bytesRead = 0;
  const total = file.size;
  const batch: ContactRow[] = [];
  const seen = new Set<string>();

  function flushBatch() {
    if (!batch.length) return null;
    const out = batch.splice(0);
    return out;
  }

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    buf += decoder.decode(value, { stream: true });

    const lastNl = buf.lastIndexOf("\\n");
    if (lastNl === -1) continue;
    const chunkText = buf.slice(0, lastNl);
    buf = buf.slice(lastNl + 1);

    const { data } = Papa.parse<ContactRow>(chunkText, { header: true, skipEmptyLines: true });
    for (const r of data) {
      if (!r.email || !/.+@.+\\..+/.test(r.email)) continue;
      const email = r.email.trim().toLowerCase();
      if (seen.has(email)) continue;
      seen.add(email);
      batch.push({
        email,
        firstName: r.firstName?.trim(),
        lastName: r.lastName?.trim(),
        phone: r.phone?.replace(/[^0-9+]/g, ""),
      });
      if (batch.length >= CHUNK) {
        onProgress?.(Math.min(100, (bytesRead / total) * 100));
        yield batch.splice(0);
      }
    }
  }
  if (buf.trim()) {
    // tail row
  }
  onProgress?.(100);
  const tail = flushBatch();
  if (tail) yield tail;
}
`;

const ROUTE_V1 = `// app/api/contacts/import/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ContactRow } from "@/lib/csv-parser";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("unauthorized", { status: 401 });

  const rows = (await req.json()) as ContactRow[];
  if (!Array.isArray(rows)) return NextResponse.json({ error: "expected array" }, { status: 400 });

  const created = await db.contact.createMany({
    data: rows.map((r) => ({ ...r, ownerId: session.user.id })),
    skipDuplicates: true,
  });

  return NextResponse.json({ created: created.count });
}
`;

const UI_V1 = `// app/contacts/import/page.tsx — upload + progress
"use client";
import { useState } from "react";
import { streamContactsCsv } from "@/lib/csv-parser";

export default function ImportPage() {
  const [progress, setProgress] = useState(0);
  const [imported, setImported] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setProgress(0); setImported(0); setError(null);
    let count = 0;
    try {
      for await (const batch of streamContactsCsv(file, setProgress)) {
        const res = await fetch("/api/contacts/import", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(batch),
        });
        const { created } = await res.json();
        count += created;
        setImported(count);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-xl font-semibold">Import contacts</h1>
      <input
        type="file" accept=".csv"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        className="mt-4 block w-full"
      />
      {progress > 0 && (
        <div className="mt-4">
          <div className="h-2 w-full rounded bg-zinc-200">
            <div className="h-2 rounded bg-emerald-500 transition-all" style={{ width: progress + "%" }} />
          </div>
          <p className="mt-2 text-sm text-zinc-600">{imported.toLocaleString()} imported · {progress.toFixed(0)}%</p>
        </div>
      )}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </main>
  );
}
`;

// --- File changes ---

const fileChanges: Record<string, FileChange> = {
  fc_parser_new: {
    id: "fc_parser_new", eventId: "ev_write_parser", filePath: "lib/csv-parser.ts",
    changeType: "created", beforeContent: null, afterContent: PARSER_V1,
    diffSummary: "+27 / −0",
  },
  fc_ui_new: {
    id: "fc_ui_new", eventId: "ev_write_ui", filePath: "app/contacts/import/page.tsx",
    changeType: "created", beforeContent: null, afterContent: UI_V1,
    diffSummary: "+44 / −0",
  },
  fc_route_new: {
    id: "fc_route_new", eventId: "ev_write_route", filePath: "app/api/contacts/import/route.ts",
    changeType: "created", beforeContent: null, afterContent: ROUTE_V1,
    diffSummary: "+18 / −0",
  },
  fc_parser_stream: {
    id: "fc_parser_stream", eventId: "ev_edit_stream", filePath: "lib/csv-parser.ts",
    changeType: "modified", beforeContent: PARSER_V1, afterContent: PARSER_V2,
    diffSummary: "+44 / −16",
  },
};

// --- Snapshots ---

const snapshots: Record<string, Snapshot> = {
  snap_upload_idle: {
    id: "snap_upload_idle", eventId: "ev_snap_upload",
    title: "Upload UI · v1",
    description: "Drag-and-drop CSV picker with idle state.",
    route: "/contacts/import",
    placeholder: {
      background: "linear-gradient(135deg, #1a2e1a 0%, #2a4a2a 50%, #1a2e1a 100%)",
      label: "📂  Choose CSV",
      sublabel: "Drop a file to import contacts",
      accent: "#34d399",
    },
  },
  snap_upload_progress: {
    id: "snap_upload_progress", eventId: "ev_snap_50mb",
    title: "Progress · 50MB stress",
    description: "50MB CSV streaming through with backpressure. Browser stays responsive.",
    route: "/contacts/import",
    placeholder: {
      background: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #0f2027 100%)",
      label: "▰▰▰▰▰▱▱▱  62%",
      sublabel: "248,304 / ~400k contacts · streaming",
      accent: "#22d3ee",
    },
  },
};

// --- Feature states ---

const v1Features: FeatureState[] = [
  { name: "CSV header detection + parsing", status: "shipped", description: "PapaParse with header: true." },
  { name: "Email + phone normalization",    status: "shipped", description: "Lowercase emails, strip non-digits from phone." },
  { name: "Dedupe within file",             status: "shipped", description: "Single-pass Set-based dedupe." },
  { name: "Server route createMany",        status: "shipped", description: "Bulk insert with skipDuplicates." },
  { name: "Whole-file parse",               status: "changed_later", description: "Loads entire CSV into memory — fails on 50MB+ uploads." },
  { name: "Progress UI",                    status: "in_progress", description: "Bar shipped but stays at 0 until parse completes." },
];

const v2Features: FeatureState[] = [
  { name: "CSV header detection + parsing", status: "shipped", description: "PapaParse with header: true." },
  { name: "Email + phone normalization",    status: "shipped", description: "Lowercase emails, strip non-digits from phone." },
  { name: "Dedupe within file",             status: "shipped", description: "Set-based dedupe applied during streaming." },
  { name: "Server route createMany",        status: "shipped", description: "Bulk insert with skipDuplicates." },
  { name: "Streaming parser",               status: "shipped", description: "ReadableStream → batched yields of 500 rows; no full-file allocation." },
  { name: "Backpressure",                   status: "shipped", description: "Awaits POST per batch before yielding the next; browser stays responsive on 50MB." },
  { name: "Progress UI",                    status: "shipped", description: "Bar updates per batch with import counter." },
];

// --- Checkpoints ---

const checkpoints: Record<string, Checkpoint> = {
  ck_v1: {
    id: "ck_v1", eventId: "ev_ck_v1", label: "v1 — happy path works",
    shippedStateSummary: "Whole-file parse, normalize, dedupe, bulk insert. Solid for files under ~5MB. Larger files freeze the browser.",
    featureState: v1Features,
  },
  ck_v2: {
    id: "ck_v2", eventId: "ev_ck_v2", label: "v2 — streaming + backpressure",
    shippedStateSummary: "Streaming parser yields 500-row batches with progress updates. 50MB import completes in ~12s without freezing the page. Dedupe applied across the entire stream.",
    featureState: v2Features,
  },
};

// --- Events ---

const t0 = new Date("2026-05-09T14:22:00").getTime();
const at = (s: number) => new Date(t0 + s * 1000).toISOString();

const events: ReplayEvent[] = [
  {
    id: "ev_prompt_initial", sequenceNumber: 1, timestamp: at(0), type: "user_prompt",
    title: "Initial request",
    content:
`Build a CSV uploader for contacts. Needs to validate rows (real email, reasonable phone), dedupe by email, and show progress while it runs. Should land at /contacts/import.`,
  },
  {
    id: "ev_response_plan", sequenceNumber: 2, timestamp: at(7), type: "assistant_response",
    title: "Plan: PapaParse + bulk insert + simple progress bar",
    content:
`I'll use PapaParse for the CSV parse, normalize emails/phones, dedupe with a Set, and POST the rows to a route handler that uses createMany with skipDuplicates. UI is a file input with a progress bar.`,
  },
  {
    id: "ev_write_parser", sequenceNumber: 3, timestamp: at(34), type: "tool_call",
    title: "Write lib/csv-parser.ts",
    metadata: { tool: "Write", parentEventId: "ev_response_plan" },
    relatedFilePaths: ["lib/csv-parser.ts"], diffIds: ["fc_parser_new"],
  },
  {
    id: "ev_write_route", sequenceNumber: 4, timestamp: at(58), type: "tool_call",
    title: "Write app/api/contacts/import/route.ts",
    metadata: { tool: "Write", parentEventId: "ev_response_plan" },
    relatedFilePaths: ["app/api/contacts/import/route.ts"], diffIds: ["fc_route_new"],
  },
  {
    id: "ev_write_ui", sequenceNumber: 5, timestamp: at(86), type: "tool_call",
    title: "Write app/contacts/import/page.tsx",
    metadata: { tool: "Write", parentEventId: "ev_response_plan" },
    relatedFilePaths: ["app/contacts/import/page.tsx"], diffIds: ["fc_ui_new"],
  },
  {
    id: "ev_cmd_test", sequenceNumber: 6, timestamp: at(118), type: "command",
    title: "pnpm test lib/csv-parser",
    metadata: { tool: "Bash", command: "pnpm test lib/csv-parser", exitCode: 0, durationMs: 1840 },
  },
  {
    id: "ev_test_parser", sequenceNumber: 7, timestamp: at(132), type: "test_result",
    title: "Parser tests",
    metadata: {
      tests: [
        { name: "rejects rows without email", status: "pass", durationMs: 4 },
        { name: "normalizes mixed-case emails", status: "pass", durationMs: 3 },
        { name: "strips phone formatting", status: "pass", durationMs: 3 },
        { name: "dedupes within file", status: "pass", durationMs: 5 },
        { name: "handles BOM-prefixed CSV", status: "pass", durationMs: 4 },
      ],
    },
  },
  {
    id: "ev_snap_upload", sequenceNumber: 8, timestamp: at(160), type: "snapshot",
    title: "Snapshot · /contacts/import renders",
    snapshotIds: ["snap_upload_idle"],
  },
  {
    id: "ev_ck_v1", sequenceNumber: 9, timestamp: at(178), type: "checkpoint",
    title: "v1 — happy path works",
    description: "Solid for small files. Awaiting stress test.",
    metadata: { commitSha: "f80a92e" },
  },
  {
    id: "ev_prompt_stress", sequenceNumber: 10, timestamp: at(2200), type: "user_prompt",
    title: "User report: 50MB CSV hangs the browser",
    content:
`Tried importing a 50MB export from HubSpot. The browser pegs to 100% CPU, the page becomes unresponsive, and the progress bar never moves. We need this to handle real-world exports without freezing.`,
  },
  {
    id: "ev_response_stream", sequenceNumber: 11, timestamp: at(2218), type: "assistant_response",
    title: "Plan: streaming parser + per-batch POST + backpressure",
    content:
`I'll rewrite the parser as an async generator that reads File.stream(), splits on newlines, parses chunks, dedupes incrementally, and yields 500-row batches. The UI awaits each POST before pulling the next batch — natural backpressure, no overlapping requests, browser stays responsive.`,
  },
  {
    id: "ev_edit_stream", sequenceNumber: 12, timestamp: at(2260), type: "tool_call",
    title: "Edit lib/csv-parser.ts — streaming with backpressure",
    metadata: { tool: "Edit", parentEventId: "ev_response_stream" },
    relatedFilePaths: ["lib/csv-parser.ts"], diffIds: ["fc_parser_stream"],
  },
  {
    id: "ev_test_stream", sequenceNumber: 13, timestamp: at(2294), type: "test_result",
    title: "Streaming tests",
    metadata: {
      tests: [
        { name: "yields in 500-row batches", status: "pass", durationMs: 14 },
        { name: "dedupes across chunk boundary", status: "pass", durationMs: 22 },
        { name: "progress reaches 100", status: "pass", durationMs: 6 },
        { name: "50MB synthetic CSV in <15s", status: "pass", durationMs: 11820 },
      ],
    },
  },
  {
    id: "ev_snap_50mb", sequenceNumber: 14, timestamp: at(2320), type: "snapshot",
    title: "Snapshot · 50MB streaming",
    snapshotIds: ["snap_upload_progress"],
  },
  {
    id: "ev_ck_v2", sequenceNumber: 15, timestamp: at(2340), type: "checkpoint",
    title: "v2 — streaming + backpressure",
    description: "50MB imports complete without freezing. Memory stays flat.",
    metadata: { commitSha: "1a2b3c4" },
  },
];

// --- Session ---

export const csvImportSession: Session = {
  id: "sess_csv_import_2026_05_09",
  project,
  title: "Contacts CSV import — happy path → 50MB streaming",
  shortDescription: "Built a CSV uploader with validation, dedupe, and progress. Caught a freeze on real-world 50MB exports; rewrote as a streaming async generator with backpressure.",
  tags: ["csv", "streaming", "perf", "feature"],
  startedAt: at(0), endedAt: at(2340),
  finalSummary:
`Shipped a contacts CSV importer in two passes.

The v1 build delivered the happy path: PapaParse with header detection, email/phone normalization, in-file dedupe, and a route handler doing createMany with skipDuplicates. Parser tests all green. The UI lived at /contacts/import with a file picker and progress bar.

User caught the obvious gap: a real-world 50MB HubSpot export pegged the CPU and froze the page. The v2 build rewrote the parser as an async generator over File.stream(), yielding 500-row batches with incremental dedupe across the stream. The UI awaits each batched POST before pulling the next, giving natural backpressure. A synthetic 50MB CSV now imports in under 15 seconds with the browser fully responsive.`,
  events, fileChanges, snapshots, checkpoints,
  filePaths: ["lib/csv-parser.ts", "app/contacts/import/page.tsx", "app/api/contacts/import/route.ts"],
  shippedSummary: {
    headline: "Streaming CSV contacts import with backpressure and progress.",
    features: v2Features,
    files: ["lib/csv-parser.ts", "app/contacts/import/page.tsx", "app/api/contacts/import/route.ts"],
    knownGaps: [
      "No column mapping UI — assumes canonical headers (email, firstName, lastName, phone).",
      "Failed rows are silently skipped; no error report download.",
      "No undo / rollback once import starts.",
    ],
  },
};
