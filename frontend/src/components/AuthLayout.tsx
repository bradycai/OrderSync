import type { ReactNode } from "react";

/** Centered card shared by sign in and sign up, branded to match the app shell. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand auth-brand">
          <span className="brand-mark">OW</span>
          <div>
            <div className="brand-name">OrderWatch</div>
            <div className="brand-sub">Operations assistant</div>
          </div>
        </div>

        <h1 className="auth-title">{title}</h1>
        <p className="auth-sub">{subtitle}</p>

        {children}

        <div className="auth-foot">{footer}</div>
      </div>

      <p className="fine auth-fine">
        Prototype — all data is synthetic and every outward action is simulated.
      </p>
    </div>
  );
}

/** One labelled input. `error` renders the server's message under the field. */
export function Field({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  placeholder,
  error,
  autoFocus,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  placeholder?: string;
  error?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={error ? "input input-error" : "input"}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
