import { useEffect } from "react";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export function SignInPage() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const destination = (location.state as { from?: { pathname?: string; search?: string; hash?: string } } | null)?.from;

  useEffect(() => {
    document.title = "Sign in · Gem Life";
  }, []);

  if (auth.session) return <Navigate to="/" replace />;

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await auth.signIn(email, password)) {
      setPassword("");
      const path = destination?.pathname ?? "/";
      navigate(`${path}${destination?.search ?? ""}${destination?.hash ?? ""}`, { replace: true });
    }
  }

  return (
    <main className="sign-in-page">
      <section className="sign-in-card" aria-labelledby="sign-in-title">
        <p className="eyebrow">Private account access</p>
        <h1 id="sign-in-title">Sign in to Gem Life</h1>
        <p className="sign-in-description">
          Sign in to your private Gem Life workspace. Your records are loaded only after the API confirms your session.
        </p>
        {auth.error && (
          <p className="sign-in-error" role="alert">
            {auth.error}
          </p>
        )}
        {!auth.configurationReady && (
          <aside className="sign-in-setup" aria-label="Sign-in setup required">
            <strong>Sign-in setup required</strong>
            <p>
              Configure <code>LOCAL_AUTH_USERNAME</code>, <code>LOCAL_AUTH_PASSWORD</code>, and
              <code> GEM_LIFE_OPERATOR_ACCOUNT_ID</code> on the API.
            </p>
          </aside>
        )}
        <form className="sign-in-form" onSubmit={(event) => void signIn(event)}>
          <label htmlFor="sign-in-email">Username</label>
          <input
            id="sign-in-email"
            name="email"
            type="text"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={auth.busy}
          />
          <label htmlFor="sign-in-password">Password</label>
          <input
            id="sign-in-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={auth.busy}
          />
          <button className="credential-sign-in-button" type="submit" disabled={auth.busy || !auth.configurationReady}>
            {auth.busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        {auth.busy && <p role="status">Verifying your account…</p>}
        <p className="sign-in-footnote">Account creation is disabled. Ask the Gem Life owner to provision access.</p>
        <p className="sign-in-footnote">Only an API-issued, expiring bearer session unlocks protected records.</p>
      </section>
    </main>
  );
}
