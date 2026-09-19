import type { ReactNode } from "react";

/** Shared responsive sign-in and registration layout. */
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
      <div className="auth-frame">
        <aside className="auth-intro">
          <div className="brand">
            <span className="brand-mark">OS</span>
            <div className="brand-name">OrderSync</div>
          </div>
          <div className="auth-intro-copy">
            <p className="auth-eyebrow">A little less busywork.</p>
            <h2>Every order.<br />One clear picture.</h2>
            <p>Bring your orders together, keep an eye on stock, and know what needs your attention.</p>
          </div>
          <div className="auth-workflow" aria-label="Your workflow">
            <div><span>01</span><p>Bring orders together<small>One place to see what’s coming in.</small></p></div>
            <div><span>02</span><p>Catch the exceptions<small>Spot shortages before they become surprises.</small></p></div>
            <div><span>03</span><p>Decide what happens next<small>Review every action. Stay in control.</small></p></div>
          </div>
          <p className="auth-intro-note">Built for the person behind the business.</p>
        </aside>
        <main className="auth-card">
        <div className="brand auth-brand">
          <span className="brand-mark">OS</span>
          <div>
            <div className="brand-name">OrderSync</div>
            <div className="brand-sub">Operations assistant</div>
          </div>
        </div>

        <p className="auth-eyebrow auth-form-eyebrow">Your operations, organized</p>
        <h1 className="auth-title">{title}</h1>
        <p className="auth-sub">{subtitle}</p>

        {children}

        <div className="auth-foot">{footer}</div>
        </main>
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
