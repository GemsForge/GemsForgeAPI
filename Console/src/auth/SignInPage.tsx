import { useEffect } from "react";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Form } from "tamagui";
import { useAuth } from "./AuthProvider";
import { AuthBrand, AuthError, PasswordField } from "./AuthParts";

export function SignInPage() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const destination = (location.state as { from?: { pathname?: string; search?: string; hash?: string } } | null)?.from;

  useEffect(() => {
    document.title = "Sign in · Gem Life";
  }, []);

  if (auth.session) return <Navigate to="/" replace />;

  async function signIn() {
    if (await auth.signIn(username, password)) {
      setPassword("");
      const path = destination?.pathname ?? "/";
      navigate(`${path}${destination?.search ?? ""}${destination?.hash ?? ""}`, { replace: true });
    }
  }

  return (
    <main className="sign-in-page">
      <section className="sign-in-card" aria-labelledby="sign-in-title">
        <AuthBrand />
        <p className="eyebrow">Private account access</p>
        <h1 id="sign-in-title">Sign in to Gem Life</h1>
        <p className="sign-in-description">
          Sign in to your private Gem Life workspace. Your records are loaded only after the API confirms your session.
        </p>
        {auth.error && <AuthError message={auth.error} />}
        {!auth.configurationReady && (
          <aside className="sign-in-setup" aria-label="Sign-in setup required">
            <strong>Sign-in setup required</strong>
            <p>
              Configure <code>LOCAL_AUTH_USERNAME</code>, <code>LOCAL_AUTH_PASSWORD</code>, and
              <code> GEM_LIFE_OPERATOR_ACCOUNT_ID</code> on the API.
            </p>
          </aside>
        )}
        <Form className="sign-in-form" onSubmit={() => void signIn()}>
          <div className="sign-in-field">
            <label htmlFor="sign-in-username">Username</label>
            <input
              id="sign-in-username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={auth.busy}
            />
          </div>
          <PasswordField
            id="sign-in-password"
            label="Password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={auth.busy}
            aria-describedby="sign-in-password-help"
          />
          <p className="sign-in-help" id="sign-in-password-help">
            Forgot your password? Ask the Gem Life owner to reset it.
          </p>
          <button className="credential-sign-in-button" type="submit" disabled={auth.busy || !auth.configurationReady}>
            {auth.busy ? "Signing in…" : "Sign in"}
          </button>
        </Form>
        {auth.busy && <p role="status">Verifying your account…</p>}
        <p className="sign-in-footnote">
          Account creation is disabled; the Gem Life owner provisions access. Sessions expire automatically.
        </p>
      </section>
    </main>
  );
}
