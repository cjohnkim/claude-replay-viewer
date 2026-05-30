import type { Session, FileChange } from "./types";

/**
 * Reconstruct file contents at a given event index (inclusive).
 * Walks events 0..index, applies any file_change side-effects in order.
 */
export function fileStateAt(session: Session, eventIndex: number): Map<string, string | null> {
  const state = new Map<string, string | null>();
  const upto = Math.min(eventIndex, session.events.length - 1);
  for (let i = 0; i <= upto; i++) {
    const ev = session.events[i];
    for (const fcId of ev.diffIds ?? []) {
      const fc = session.fileChanges[fcId];
      if (!fc) continue;
      applyFileChange(state, fc);
    }
  }
  return state;
}

function applyFileChange(state: Map<string, string | null>, fc: FileChange) {
  switch (fc.changeType) {
    case "created":
    case "modified":
      state.set(fc.filePath, fc.afterContent);
      break;
    case "deleted":
      state.set(fc.filePath, null);
      break;
    case "renamed":
      if (fc.oldPath) state.delete(fc.oldPath);
      state.set(fc.filePath, fc.afterContent);
      break;
  }
}

/** Final shipped file state — applies all events. */
export function finalFileState(session: Session): Map<string, string | null> {
  return fileStateAt(session, session.events.length - 1);
}

/** Latest checkpoint <= eventIndex */
export function latestCheckpoint(session: Session, eventIndex: number) {
  const upto = Math.min(eventIndex, session.events.length - 1);
  for (let i = upto; i >= 0; i--) {
    const ev = session.events[i];
    if (ev.type === "checkpoint") {
      const ck = Object.values(session.checkpoints).find((c) => c.eventId === ev.id);
      if (ck) return { event: ev, checkpoint: ck };
    }
  }
  return null;
}

/** Most recent file_change for a given filePath as of eventIndex */
export function latestChangeFor(
  session: Session,
  filePath: string,
  eventIndex: number
): FileChange | null {
  const upto = Math.min(eventIndex, session.events.length - 1);
  for (let i = upto; i >= 0; i--) {
    const ev = session.events[i];
    for (const fcId of ev.diffIds ?? []) {
      const fc = session.fileChanges[fcId];
      if (fc && fc.filePath === filePath) return fc;
    }
  }
  return null;
}

/** Index of the next event of a given type after current. -1 if none. */
export function nextEventOfTypes(
  session: Session,
  current: number,
  types: ReadonlyArray<string>
): number {
  for (let i = current + 1; i < session.events.length; i++) {
    if (types.includes(session.events[i].type)) return i;
  }
  return -1;
}

export function prevEventOfTypes(
  session: Session,
  current: number,
  types: ReadonlyArray<string>
): number {
  for (let i = current - 1; i >= 0; i--) {
    if (types.includes(session.events[i].type)) return i;
  }
  return -1;
}
