import type { Session, Project } from "../types";
import { loadAllSessions } from "../ingest";

export interface ProjectWithSessions {
  project: Project;
  sessions: Session[];
}

export async function getAllSessions(): Promise<Session[]> {
  return loadAllSessions();
}

export async function getSession(id: string): Promise<Session | undefined> {
  const all = await loadAllSessions();
  return all.find((s) => s.id === id);
}

/** Sessions grouped by project, projects ordered by most-recent session. */
export async function groupByProject(): Promise<ProjectWithSessions[]> {
  const all = await loadAllSessions();
  const byId = new Map<string, ProjectWithSessions>();
  for (const s of all) {
    const entry = byId.get(s.project.id);
    if (entry) entry.sessions.push(s);
    else byId.set(s.project.id, { project: s.project, sessions: [s] });
  }
  return Array.from(byId.values()).sort(
    (a, b) =>
      new Date(b.sessions[0].startedAt).getTime() -
      new Date(a.sessions[0].startedAt).getTime()
  );
}
