import type { Session, ReplayEvent, FileChange, Snapshot, Checkpoint, FeatureState, Project } from "../types";

const project: Project = {
  id: "kids-games",
  name: "Kids Games",
  description: "Tiny browser games for kids — single-file HTML, no build, big tiles, friendly creatures.",
};

// --- File content fixtures (excerpted, realistic) ---

const FILE_V1 = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Bunny Maze</title>
<style>
  html, body { margin: 0; height: 100%; background: #d6f5d6; font-family: sans-serif; }
  #wrap { display: flex; flex-direction: column; align-items: center; }
  canvas { background: #fff8e7; border-radius: 20px; }
</style>
</head>
<body>
<div id="wrap">
  <div id="hud">Level <span id="level">1</span> · <span id="carrots">0</span></div>
  <canvas id="game" width="640" height="640"></canvas>
  <div id="msg">Use the arrow keys to hop!</div>
</div>
<script>
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // Hand-designed mazes: 1 = wall, 0 = path, S = start, E = exit, C = carrot, B = bear
  const LEVELS = [
    {
      name: "The Meadow",
      grid: [
        "1111111111",
        "1S00C00001",
        "1011111101",
        "10000F0101",
        "1110110101",
        "100C100C01",
        "10101111B1",
        "1010000001",
        "10000C001E",
        "1111111111",
      ],
    },
    // ... 4 more hand-designed levels ...
  ];

  // ... rendering, movement, input handling ...
})();
</script>
</body>
</html>
`;

const FILE_V2 = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Bunny Maze</title>
<style>
  html, body { margin: 0; height: 100%; background: #d6f5d6; font-family: sans-serif; }
  #wrap { display: flex; flex-direction: column; align-items: center; }
  canvas { background: #fff8e7; border-radius: 20px; }
</style>
</head>
<body>
<div id="wrap">
  <div id="hud">Level <span id="level">1</span> · <span id="carrots">0</span></div>
  <canvas id="game" width="640" height="640"></canvas>
  <div id="msg">Use the arrow keys to hop!</div>
</div>
<script>
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // Procedurally generated mazes — every cell reachable, guaranteed solvable.
  const LEVEL_CONFIGS = [
    { cols:  9, rows:  7, carrots: 3, bears: 1, flowers: 3, knockout: 0.35, name: "The Meadow" },
    { cols: 11, rows:  9, carrots: 4, bears: 2, flowers: 4, knockout: 0.30, name: "Bear Hill" },
    { cols: 13, rows: 11, carrots: 5, bears: 2, flowers: 5, knockout: 0.25, name: "Carrot Forest" },
    { cols: 15, rows: 11, carrots: 6, bears: 3, flowers: 6, knockout: 0.22, name: "Bunny Burrow" },
    { cols: 17, rows: 13, carrots: 8, bears: 4, flowers: 7, knockout: 0.18, name: "Big Adventure" },
  ];

  function bfsReachable(g, sc, sr) { /* BFS from start, returns visited grid + cells */ }
  function generateLevel(cfg) {
    // 1. Carve corridors with iterative recursive backtracker
    // 2. Knock out ~knockout fraction of interior walls for openness
    // 3. Place S at (1,1), E at (cols-2, rows-2)
    // 4. BFS verify exit reachable; carve L-fallback if not
    // 5. Pick reachable cells for carrots/bears/flowers
  }

  const LEVELS = LEVEL_CONFIGS.map(generateLevel);

  // ... rendering, movement, input handling — unchanged ...
})();
</script>
</body>
</html>
`;

// --- File changes ---

const fileChanges: Record<string, FileChange> = {
  fc_create: {
    id: "fc_create",
    eventId: "ev_write_v1",
    filePath: "bunny-maze.html",
    changeType: "created",
    beforeContent: null,
    afterContent: FILE_V1,
    diffSummary: "+34 / −0",
  },
  fc_procgen: {
    id: "fc_procgen",
    eventId: "ev_edit_procgen",
    filePath: "bunny-maze.html",
    changeType: "modified",
    beforeContent: FILE_V1,
    afterContent: FILE_V2,
    diffSummary: "+24 / −15",
  },
};

// --- Snapshots ---

const snapshots: Record<string, Snapshot> = {
  snap_v1: {
    id: "snap_v1",
    eventId: "ev_snap_v1",
    title: "v1 — walled-off house",
    description: "Initial hand-designed maze. The exit house in level 1 has walls on every adjacent cell — unreachable.",
    route: "bunny-maze.html · Level 1",
    placeholder: {
      background: "linear-gradient(135deg, #2d4a2f 0%, #3a5a3d 50%, #2a3d2d 100%)",
      label: "🐰  walled in",
      sublabel: "Level 1 · House unreachable",
      accent: "#d35400",
    },
  },
  snap_v2: {
    id: "snap_v2",
    eventId: "ev_snap_v2",
    title: "v2 — procgen maze, solvable",
    description: "Procedurally generated 9×7 meadow. BFS verifies the exit and every carrot is reachable from start.",
    route: "bunny-maze.html · Level 1 (regen)",
    placeholder: {
      background: "linear-gradient(135deg, #2d4a2f 0%, #4a7a4f 50%, #2a3d2d 100%)",
      label: "🐰 🥕 🏠",
      sublabel: "Level 1 · Reachable + elaborate",
      accent: "#9fe0a8",
    },
  },
  snap_v2_big: {
    id: "snap_v2_big",
    eventId: "ev_snap_v2",
    title: "Level 5 — Big Adventure",
    description: "17×13 procgen maze with 8 carrots and 4 bears. Loop-holes added for kid-friendly paths.",
    route: "bunny-maze.html · Level 5",
    placeholder: {
      background: "linear-gradient(135deg, #1f3a1f 0%, #4a7a4f 50%, #2a3d2d 100%)",
      label: "🐰 → 🏠",
      sublabel: "Level 5 · 17×13 · 8🥕 4🐻",
      accent: "#a0acff",
    },
  },
};

// --- Checkpoints ---

const v1Features: FeatureState[] = [
  { name: "Arrow-key bunny movement",  status: "shipped",     description: "Tile-step movement with smooth interpolation." },
  { name: "Carrot collection",         status: "shipped",     description: "Walking onto a carrot increments the counter." },
  { name: "Friendly bears",            status: "shipped",     description: "Bears greet the bunny instead of ending the game." },
  { name: "5 hand-designed levels",    status: "changed_later", description: "Replaced by procgen in v2 — level 1's exit was unreachable." },
  { name: "Sound effects",             status: "shipped",     description: "Hop chirp, carrot ping, win chord via WebAudio." },
  { name: "Touch controls",            status: "shipped",     description: "On-screen D-pad + swipe." },
];

const v2Features: FeatureState[] = [
  { name: "Arrow-key bunny movement",  status: "shipped",     description: "Tile-step movement with smooth interpolation." },
  { name: "Carrot collection",         status: "shipped",     description: "Walking onto a carrot increments the counter." },
  { name: "Friendly bears",            status: "shipped",     description: "Bears greet the bunny instead of ending the game." },
  { name: "Procgen mazes (BFS-verified)", status: "shipped",  description: "Recursive backtracker + reachability check + L-path fallback." },
  { name: "Difficulty progression",    status: "shipped",     description: "9×7 → 17×13 across 5 levels; carrots/bears scale up." },
  { name: "Loop-hole openness",        status: "shipped",     description: "Knock out 18–35% of interior walls so kids aren't stuck in tight corridors." },
  { name: "Replayability",             status: "shipped",     description: "Mazes regenerate when looping back to level 1." },
  { name: "Sound effects",             status: "shipped",     description: "Hop chirp, carrot ping, win chord via WebAudio." },
  { name: "Touch controls",            status: "shipped",     description: "On-screen D-pad + swipe." },
];

const checkpoints: Record<string, Checkpoint> = {
  ck_v1: {
    id: "ck_v1",
    eventId: "ev_ck_v1",
    label: "v1 shipped",
    shippedStateSummary: "First playable build. Five hand-designed mazes with bunny, bears, carrots, and a house exit. Reported bug: level 1 exit unreachable.",
    featureState: v1Features,
  },
  ck_v2: {
    id: "ck_v2",
    eventId: "ev_ck_v2",
    label: "v2 shipped — procgen",
    shippedStateSummary: "Procedural mazes guaranteed solvable. More elaborate as difficulty climbs. Mazes regenerate on replay.",
    featureState: v2Features,
  },
};

// --- Events ---

const t0 = new Date("2026-05-17T09:32:00").getTime();
const at = (offsetSeconds: number) => new Date(t0 + offsetSeconds * 1000).toISOString();

const events: ReplayEvent[] = [
  {
    id: "ev_prompt_initial",
    sequenceNumber: 1,
    timestamp: at(0),
    type: "user_prompt",
    title: "Initial request",
    content:
`can you build me a maze game for a 5 year old to use arrow controllers and advance through fun mazes with bunnies in them — it should be easy and fun. there should be some bears too`,
  },
  {
    id: "ev_response_plan",
    sequenceNumber: 2,
    timestamp: at(6),
    type: "assistant_response",
    title: "Plan: single-file HTML game",
    content:
`I'll build a single self-contained HTML game — big tiles, friendly bears (no scary game-over), bunny collects carrots, then reaches the exit. I'll save it to your home folder and open it.`,
  },
  {
    id: "ev_write_v1",
    sequenceNumber: 3,
    timestamp: at(18),
    type: "tool_call",
    title: "Write bunny-maze.html",
    description: "Create the initial single-file game with five hand-designed mazes.",
    metadata: { tool: "Write", parentEventId: "ev_response_plan" },
    relatedFilePaths: ["bunny-maze.html"],
    diffIds: ["fc_create"],
  },
  {
    id: "ev_open_v1",
    sequenceNumber: 4,
    timestamp: at(22),
    type: "command",
    title: "open bunny-maze.html",
    description: "Launch the game in the default browser.",
    metadata: { tool: "Bash", command: "open /Users/chulhojkim/bunny-maze.html", exitCode: 0, durationMs: 184 },
  },
  {
    id: "ev_snap_v1",
    sequenceNumber: 5,
    timestamp: at(30),
    type: "snapshot",
    title: "Snapshot · v1 maze loads",
    description: "Game boots. Level 1 renders. Level 1's exit is in a corner with walls on every adjacent tile.",
    snapshotIds: ["snap_v1"],
  },
  {
    id: "ev_ck_v1",
    sequenceNumber: 6,
    timestamp: at(34),
    type: "checkpoint",
    title: "v1 shipped",
    description: "First playable build. Awaiting feedback.",
    metadata: { commitSha: "a4f2c19" },
  },
  {
    id: "ev_prompt_feedback",
    sequenceNumber: 7,
    timestamp: at(420),
    type: "user_prompt",
    title: "User feedback: house unreachable + elaborate request",
    content:
`there's no way to get into the house lol — make sure you make it possible to get in. also make the mazes a little bit more elaborate.`,
  },
  {
    id: "ev_response_procgen",
    sequenceNumber: 8,
    timestamp: at(432),
    type: "assistant_response",
    title: "Plan: switch to procgen + BFS verification",
    content:
`You're right — I goofed and walled the house in. The fix: switch to procedurally generated mazes (recursive backtracker), which guarantees every cell — including the exit — is reachable. Bigger and more elaborate as you progress, with a fresh shape each time.`,
  },
  {
    id: "ev_edit_procgen",
    sequenceNumber: 9,
    timestamp: at(460),
    type: "tool_call",
    title: "Edit bunny-maze.html — replace LEVELS with generator",
    description: "Swap the hand-designed LEVELS array for a procedural generator, BFS validator, and L-path fallback.",
    metadata: { tool: "Edit", parentEventId: "ev_response_procgen" },
    relatedFilePaths: ["bunny-maze.html"],
    diffIds: ["fc_procgen"],
  },
  {
    id: "ev_test_bfs",
    sequenceNumber: 10,
    timestamp: at(478),
    type: "test_result",
    title: "Sanity check: BFS reachability",
    description: "Manual smoke check — every config produces a maze where start can reach exit and every carrot.",
    metadata: {
      tests: [
        { name: "9×7 meadow reachable", status: "pass", durationMs: 4 },
        { name: "11×9 hill reachable", status: "pass", durationMs: 6 },
        { name: "13×11 forest reachable", status: "pass", durationMs: 9 },
        { name: "15×11 burrow reachable", status: "pass", durationMs: 11 },
        { name: "17×13 adventure reachable", status: "pass", durationMs: 14 },
      ],
    },
  },
  {
    id: "ev_open_v2",
    sequenceNumber: 11,
    timestamp: at(486),
    type: "command",
    title: "open bunny-maze.html",
    description: "Relaunch with procgen mazes.",
    metadata: { tool: "Bash", command: "open /Users/chulhojkim/bunny-maze.html", exitCode: 0, durationMs: 162 },
  },
  {
    id: "ev_snap_v2",
    sequenceNumber: 12,
    timestamp: at(494),
    type: "snapshot",
    title: "Snapshot · v2 maze, solvable",
    description: "Level 1 renders fresh each load. Exit reachable. Level 5 is 17×13 with 8 carrots.",
    snapshotIds: ["snap_v2", "snap_v2_big"],
  },
  {
    id: "ev_artifact_v2",
    sequenceNumber: 13,
    timestamp: at(498),
    type: "artifact",
    title: "Artifact · bunny-maze.html (v2)",
    description: "Single-file deliverable, ~600 lines, no build step.",
    metadata: { artifactName: "bunny-maze.html", durationMs: 0 },
    relatedFilePaths: ["bunny-maze.html"],
  },
  {
    id: "ev_ck_v2",
    sequenceNumber: 14,
    timestamp: at(504),
    type: "checkpoint",
    title: "v2 shipped — procgen mazes",
    description: "Solvability guaranteed. More elaborate. Replayable.",
    metadata: { commitSha: "b71d3e0" },
  },
];

// --- Final session ---

export const bunnyMazeSession: Session = {
  id: "sess_bunny_maze_2026_05_17",
  project,
  title: "Bunny Maze — kid-friendly game build",
  shortDescription: "Built a single-file HTML maze game for a 5-year-old. Caught a walled-off-exit bug on first ship; refactored to BFS-verified procgen mazes.",
  tags: ["game", "html", "procgen", "kids"],
  startedAt: at(0),
  endedAt: at(504),
  finalSummary:
`A single-file HTML maze game for a 5-year-old, built and iterated in one session.

The first build shipped five hand-designed mazes with arrow-key bunny movement, carrot collection, and friendly (non-fatal) bears. User feedback caught a critical bug: Level 1's exit house was walled-in and unreachable. The second build replaced hand-designed grids with a procedural generator (recursive backtracker + BFS reachability check + L-path fallback), and scaled the mazes from 9×7 up to 17×13 across five levels. The procgen mazes regenerate on replay, are guaranteed solvable, and are visibly more elaborate while remaining kid-friendly thanks to 18–35% wall knockout for "loop holes."`,
  events,
  fileChanges,
  snapshots,
  checkpoints,
  filePaths: ["bunny-maze.html"],
  shippedSummary: {
    headline: "bunny-maze.html — procgen maze game for kids",
    features: v2Features,
    files: ["bunny-maze.html"],
    knownGaps: [
      "No persistent high score / level progress.",
      "Music loop not implemented (only SFX).",
      "No accessibility audit yet (color contrast, motion reduce).",
    ],
  },
};
