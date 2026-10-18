import { useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export function SignInPage() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const destination = (location.state as { from?: { pathname?: string; search?: string; hash?: string } } | null)?.from;

  useEffect(() => {
    document.title = "Sign in · Gem Life";
  }, []);

  if (auth.session) return <Navigate to="/" replace />;

  async function signIn() {
    if (await auth.signIn()) {
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
          Use your Apple Account to open your private Gem Life workspace. Your records are loaded only after the API
          confirms your session.
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
              Configure <code>VITE_APPLE_CLIENT_ID</code> and a registered HTTPS <code>VITE_APPLE_REDIRECT_URI</code>
              for the Console. Set the matching <code>APPLE_CLIENT_ID</code> on the API. Apple does not accept localhost
              or an IP address as the registered redirect domain.
            </p>
          </aside>
        )}
        <button
          className="apple-sign-in-button"
          type="button"
          onClick={() => void signIn()}
          disabled={auth.busy || !auth.configurationReady}
        >
          {auth.busy ? "Connecting to Apple…" : "Continue with Apple"}
        </button>
        {auth.busy && <p role="status">Waiting for Apple sign-in…</p>}
        <p className="sign-in-footnote">Only an API-issued, expiring bearer session unlocks protected records.</p>
      </section>
    </main>
  );
}
