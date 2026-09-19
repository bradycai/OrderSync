import { randomUUID } from "node:crypto";
import { jsonTable } from "./fileStore";

interface Session {
  id: string;
  userId: string;
  expiresAt: string;
}

const table = jsonTable<Session>("sessions.json");

/**
 * Persisted rather than held in a Map on purpose: `tsx watch` restarts the
 * backend on every save, and an in-memory store would sign you out each time.
 */
export const SESSION_DAYS = Number(process.env.AUTH_SESSION_DAYS ?? 7);
export const SESSION_MAX_AGE_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

const isLive = (s: Session) => new Date(s.expiresAt).getTime() > Date.now();

export async function createSession(userId: string): Promise<string> {
  const sessions = await table.readAll();
  const session: Session = {
    id: randomUUID(),
    userId,
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString(),
  };
  // Drop expired rows while we are writing anyway.
  await table.writeAll([...sessions.filter(isLive), session]);
  return session.id;
}

/** Null for unknown or expired ids, so callers never need to check expiry. */
export async function getSessionUserId(id: string): Promise<string | null> {
  const session = (await table.readAll()).find((s) => s.id === id);
  if (!session || !isLive(session)) return null;
  return session.userId;
}

export async function destroySession(id: string): Promise<void> {
  const sessions = await table.readAll();
  await table.writeAll(sessions.filter((s) => s.id !== id && isLive(s)));
}
