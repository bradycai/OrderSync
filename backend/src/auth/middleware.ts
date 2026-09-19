import type { NextFunction, Request, Response } from "express";
import { getSessionUserId } from "./sessions";
import { findById, toPublicUser, type PublicUser } from "./users";

export const SESSION_COOKIE = "ordersync_session";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}

/** Resolves the session cookie to a user, or null. Never throws. */
export async function currentUser(req: Request): Promise<PublicUser | null> {
  const sessionId = req.cookies?.[SESSION_COOKIE];
  if (typeof sessionId !== "string" || !sessionId) return null;

  const userId = await getSessionUserId(sessionId);
  if (!userId) return null;

  const user = await findById(userId);
  return user ? toPublicUser(user) : null;
}

/** Gate for everything behind the login. Attaches req.user on success. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: "Not signed in" });
  req.user = user;
  next();
}
