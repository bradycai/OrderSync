import { useState } from "react";
import { AuthLayout, Field } from "../components/AuthLayout";
import { useAuth } from "../auth/AuthProvider";

export function SignIn({ onSwitch }: { onSwitch: () => void }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const result = await signIn(email, password);
    // On success the provider flips status to "authed" and App swaps this page out.
    if (!result.ok) {
      setError({ message: result.error, field: result.field });
      setBusy(false);
    }
  }

  const fieldError = (name: string) =>
    error?.field === name ? error.message : undefined;

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Sign in to see orders across every channel."
      footer={
        <>
          <span className="fine">New to OrderSync?</span>{" "}
          <button type="button" className="link" onClick={onSwitch}>
            Create an account
          </button>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {/* Credential failures are deliberately not tied to a field — the server
            will not say which half was wrong. */}
        {error && !error.field && (
          <p className="form-error" role="alert">
            {error.message}
          </p>
        )}

        <Field
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          placeholder="you@example.com"
          error={fieldError("email")}
          autoFocus
        />

        <Field
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          error={fieldError("password")}
        />

        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthLayout>
  );
}
