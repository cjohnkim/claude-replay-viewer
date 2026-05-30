// Data model for the Claude Code Replay Viewer.
// Designed so real Claude Code logs can be mapped into this shape later.

export type EventType =
  | "user_prompt"
  | "assistant_response"
  | "tool_call"
  | "file_change"
  | "command"
  | "test_result"
  | "snapshot"
  | "checkpoint"
  | "commit"
  | "artifact";

export type FeatureStatus =
  | "not_started"
  | "in_progress"
  | "shipped"
  | "changed_later";

export interface FileChange {
  id: string;
  eventId: string;
  filePath: string;
  changeType: "created" | "modified" | "deleted" | "renamed";
  beforeContent: string | null;
  afterContent: string | null;
  diffSummary: string; // e.g. "+182 / −0"
  oldPath?: string;
}

export interface Snapshot {
  id: string;
  eventId: string;
  title: string;
  imageUrl?: string;
  /** Optional rendered placeholder when no real screenshot exists */
  placeholder?: {
    /** background gradient or solid hex */
    background: string;
    label: string;
    sublabel?: string;
    accent?: string;
  };
  description: string;
  /** logical route/view this represents — e.g. "/" or "Level 1 maze" */
  route: string;
}

export interface FeatureState {
  name: string;
  status: FeatureStatus;
  description: string;
}

export interface Checkpoint {
  id: string;
  eventId: string;
  label: string;
  shippedStateSummary: string;
  featureState: FeatureState[];
}

export interface TestResult {
  name: string;
  status: "pass" | "fail" | "skipped";
  durationMs?: number;
  message?: string;
}

export interface ReplayEvent {
  id: string;
  timestamp: string; // ISO
  sequenceNumber: number;
  type: EventType;
  title: string;
  description?: string;
  /** Main text payload — prompt body, assistant message, command stdout, etc. */
  content?: string;
  relatedFilePaths?: string[];
  diffIds?: string[];      // FileChange ids
  snapshotIds?: string[];  // Snapshot ids
  metadata?: Record<string, unknown> & {
    tool?: string;
    command?: string;
    exitCode?: number;
    durationMs?: number;
    tests?: TestResult[];
    commitSha?: string;
    artifactName?: string;
    /** parent event id for tool calls that belong to an assistant response */
    parentEventId?: string;
  };
}

export interface Project {
  id: string;
  name: string;
  description: string;
}

export interface Session {
  id: string;
  /** Which project this session belongs to. */
  project: Project;
  title: string;
  /** One-sentence "what was built" — shown on the picker card. */
  shortDescription: string;
  /** Optional tags for filtering the picker. */
  tags?: string[];
  startedAt: string;
  endedAt: string;
  /** auto-generated summary shown in the Summary view */
  finalSummary: string;
  /** events in causal/timestamp order */
  events: ReplayEvent[];
  /** index data — flat lists keyed by id */
  fileChanges: Record<string, FileChange>;
  snapshots: Record<string, Snapshot>;
  checkpoints: Record<string, Checkpoint>;
  /** convenience: all file paths touched during the session */
  filePaths: string[];
  /** Aggregate token consumption across all assistant responses in this session. */
  tokens?: {
    /** Raw uncached input tokens — what counts at full price. */
    input: number;
    /** Cache creation input tokens — cached on write. */
    cacheCreation: number;
    /** Cache read input tokens — read from cache at discount. */
    cacheRead: number;
    /** Output tokens generated. */
    output: number;
    /** Sum of all categories above. */
    total: number;
    /** Number of assistant turns that contributed usage. */
    turns: number;
  };
  /** Sentiment/statement markers found across user prompts. Keys are marker
   * categories ("frustration", "confusion", "breakthrough", "celebration",
   * "regret"). Value is the per-category aggregate. */
  markers?: Record<
    string,
    {
      /** Total matches of this category across the session. */
      count: number;
      /** Distinct event ids whose content matched this category. */
      eventIds: string[];
      /** Sample of the literal tokens/phrases caught — for tooltip use. */
      samples: string[];
    }
  >;
  /** Final shipped state — the answer to "what shipped" */
  shippedSummary: {
    headline: string;
    features: FeatureState[];
    files: string[];
    knownGaps: string[];
  };
}
