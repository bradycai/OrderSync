import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

/** Field-scoped failure, so a form can highlight the input that caused it. */
export interface AuthError {
  error: string;
  field?: string;
}

export type AuthResult = { ok: true } | ({ ok: false } & AuthError);

/**
 * "loading" is a distinct state on purpose: without it the sign-in page flashes
 * on every reload while GET /api/auth/me is still in flight.
 */
type Status = "loading" | "authed" | "anon";

interface Auth {
  user: AuthUser | null;
  status: Status;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (name: string, email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<Auth | null>(null);

/** Cookie is httpOnly, so every call must opt into sending credentials. */
async function post(path: string, body: unknown) {
  return fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  // Restore an existing session on first mount.
  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setUser(data?.user ?? null);
        setStatus(data?.user ? "authed" : "anon");
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setStatus("anon");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /** Shared tail for signup and signin — both return { user } on success. */
  const submit = useCallback(async (path: string, body: unknown): Promise<AuthResult> => {
    let res: Response;
    try {
      res = await post(path, body);
    } catch {
      return { ok: false, error: "Could not reach the server. Is the API running?" };
    }

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        ok: false,
        error: data?.error ?? "Something went wrong. Please try again.",
        field: data?.field ?? undefined,
      };
    }

    setUser(data.user);
    setStatus("authed");
    return { ok: true };
  }, []);

  const signIn = useCallback(
    (email: string, password: string) => submit("/api/auth/signin", { email, password }),
    [submit],
  );

  const signUp = useCallback(
    (name: string, email: string, password: string) =>
      submit("/api/auth/signup", { name, email, password }),
    [submit],
  );

  const signOut = useCallback(async () => {
    // Clear locally even if the request fails, so the user is never stuck signed in.
    try {
      await post("/api/auth/signout", {});
    } finally {
      setUser(null);
      setStatus("anon");
    }
  }, []);

  const value: Auth = { user, status, signIn, signUp, signOut };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const a = useContext(AuthContext);
  if (!a) throw new Error("useAuth must be used inside <AuthProvider>");
  return a;
}
