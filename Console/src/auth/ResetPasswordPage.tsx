import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form } from "tamagui";
import { getSupabaseSignInConfiguration, updateSupabasePassword } from "./supabaseSignIn";

function recoveryToken(): string | null {
  return new URLSearchParams(window.location.hash.replace(/^#/, "")).get("access_token");
}

export function isRecoveryLink(): boolean {
  return new URLSearchParams(window.location.hash.replace(/^#/, "")).get("type") === "recovery";
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  async function submit() {
    if (!getSupabaseSignInConfiguration()) {
      setError("Supabase sign-in is not configured.");
      return;
    }
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    const token = recoveryToken();
    if (!token) {
      setError("This reset link is missing or expired. Request a new one.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateSupabasePassword(token, password);
      window.history.replaceState({}, document.title, window.location.pathname);
      setComplete(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The password could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  if (complete) {
    return (
      <main className="sign-in-page">
        <section className="sign-in-card" aria-labelledby="password-reset-complete">
          <h1 id="password-reset-complete">Password updated</h1>
          <p className="sign-in-description">Your password has been changed. You can now sign in.</p>
          <button
            className="credential-sign-in-button"
            type="button"
            onClick={() => navigate("/login", { replace: true })}
          >
            Return to sign in
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="sign-in-page">
      <section className="sign-in-card" aria-labelledby="password-reset-title">
        <p className="eyebrow">Account recovery</p>
        <h1 id="password-reset-title">Set a new password</h1>
        <p className="sign-in-description">Choose a new password for your Gem Life account.</p>
        {error && (
          <p className="sign-in-error" role="alert">
            {error}
          </p>
        )}
        <Form className="sign-in-form" onSubmit={() => void submit()}>
          <label htmlFor="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
          />
          <label htmlFor="confirm-password">Confirm password</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={busy}
          />
          <button className="credential-sign-in-button" type="submit" disabled={busy}>
            {busy ? "Updating…" : "Update password"}
          </button>
        </Form>
      </section>
    </main>
  );
}
