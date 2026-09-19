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
            <span className="brand-mark">OW</span>
            <div className="brand-name">OrderWatch</div>
          </div>
          <div className="auth-intro-copy">
            <h2>Orders across every channel</h2>
            <p>Shopify, TikTok Shop, Amazon, and eBay in one view, with stock math and alerts computed on the server.</p>
          </div>
          <div className="auth-workflow" aria-label="What it does">
            <div><p>Unified orders<small>Imports dedupe on channel and marketplace order ID.</small></p></div>
            <div><p>Inventory alerts<small>Shortages and overdue orders from deterministic rules.</small></p></div>
            <div><p>Drafted replies<small>AI-drafted, editable, and never sent without approval.</small></p></div>
          </div>
        </aside>
        <main className="auth-card">
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
