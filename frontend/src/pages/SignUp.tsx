import { useState } from "react";
import { AuthLayout, Field } from "../components/AuthLayout";
import { useAuth } from "../auth/AuthProvider";

const MIN_PASSWORD = 8;

export function SignUp({ onSwitch }: { onSwitch: () => void }) {
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Mirrors the server's zod rules for faster feedback. The server still decides.
    if (!name.trim()) return setError({ message: "Name is required", field: "name" });
    if (password.length < MIN_PASSWORD) {
      return setError({
        message: `Password must be at least ${MIN_PASSWORD} characters`,
        field: "password",
      });
    }

    setBusy(true);
    const result = await signUp(name, email, password);
    if (!result.ok) {
      setError({ message: result.error, field: result.field });
      setBusy(false);
    }
  }

  const fieldError = (field: string) =>
    error?.field === field ? error.message : undefined;

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Set up a login to open the OrderWatch operations dashboard."
      footer={
        <>
          <span className="fine">Already have an account?</span>{" "}
          <button type="button" className="link" onClick={onSwitch}>
            Sign in
          </button>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {error && !error.field && (
          <p className="form-error" role="alert">
            {error.message}
          </p>
        )}

        <Field
          id="name"
          label="Name"
          type="text"
          value={name}
          onChange={setName}
          autoComplete="name"
          placeholder="Jayden Gajewski"
          error={fieldError("name")}
          autoFocus
        />

        <Field
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          placeholder="you@example.com"
          error={fieldError("email")}
        />

        <Field
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder={`At least ${MIN_PASSWORD} characters`}
          error={fieldError("password")}
        />

        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
