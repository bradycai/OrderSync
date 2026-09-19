import { Router, type CookieOptions } from "express";
import { z } from "zod";
import { SESSION_COOKIE, currentUser } from "./middleware";
import { verifyPassword } from "./passwords";
import { SESSION_MAX_AGE_MS, createSession, destroySession } from "./sessions";
import { createUser, findByEmail, toPublicUser } from "./users";

/**
 * Trim and lowercase before validating, so a trailing space from autofill is not
 * reported as an invalid address. Produces the same canonical form as
 * `normalizeEmail` in ./users.
 */
const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"));

const SignUpSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: EmailSchema,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    // Capped on sign-up only: adding a max to sign-in would lock out any
    // account that already registered a longer password.
    .max(128, "Password must be 128 characters or fewer"),
});

const SignInSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, "Password is required"),
});

/**
 * `secure` stays off outside production because dev is served over plain
 * http://localhost through the Vite proxy — a secure cookie would never be set.
 */
const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_MAX_AGE_MS,
});

/** First zod issue, shaped for inline display next to the offending field. */
const firstIssue = (error: z.ZodError) => ({
  error: error.issues[0]?.message ?? "Invalid request",
  field: error.issues[0]?.path[0] ?? null,
});

export const authRoutes = Router();

authRoutes.post("/signup", async (req, res) => {
  const parsed = SignUpSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(firstIssue(parsed.error));

  const user = await createUser(parsed.data);
  if (!user) {
    return res
      .status(409)
      .json({ error: "An account with that email already exists", field: "email" });
  }

  res.cookie(SESSION_COOKIE, await createSession(user.id), cookieOptions());
  res.status(201).json({ user: toPublicUser(user) });
});

authRoutes.post("/signin", async (req, res) => {
  const parsed = SignInSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(firstIssue(parsed.error));

  // One generic message for both branches, so this cannot enumerate accounts.
  const reject = () => res.status(401).json({ error: "Email or password is incorrect" });

  const user = await findByEmail(parsed.data.email);
  if (!user) return reject();
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return reject();

  res.cookie(SESSION_COOKIE, await createSession(user.id), cookieOptions());
  res.json({ user: toPublicUser(user) });
});

authRoutes.post("/signout", async (req, res) => {
  const sessionId = req.cookies?.[SESSION_COOKIE];
  if (typeof sessionId === "string" && sessionId) await destroySession(sessionId);

  res.clearCookie(SESSION_COOKIE, { ...cookieOptions(), maxAge: undefined });
  res.status(204).end();
});

authRoutes.get("/me", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: "Not signed in" });
  res.json({ user });
});
