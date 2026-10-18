import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api";
import { queryClient } from "../data/queryClient";
import { appleSignInError, getAppleSignInConfiguration, requestAppleIdentityToken } from "./appleSignIn";
import {
  clearSession,
  consumeExpiredSessionNotice,
  readSession,
  saveSession,
  SESSION_EXPIRED_EVENT,
  type BrowserSession,
} from "./session";

interface AuthContextValue {
  session: BrowserSession | null;
  busy: boolean;
  error: string | null;
  configurationReady: boolean;
  signIn: () => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<BrowserSession | null>(() => readSession());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    consumeExpiredSessionNotice() ? "Your sign-in expired or was revoked. Sign in again to continue." : null,
  );
  const configuration = useMemo(() => getAppleSignInConfiguration(), []);

  useEffect(() => {
    const handleExpired = () => {
      clearSession();
      setSession(null);
      queryClient.clear();
      setError("Your sign-in expired or was revoked. Sign in again to continue.");
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  }, []);

  const signIn = useCallback(async () => {
    if (!configuration) {
      setError(
        "Sign in with Apple is not configured for this Console. Set VITE_APPLE_CLIENT_ID and a registered HTTPS VITE_APPLE_REDIRECT_URI; configure the same client ID as APPLE_CLIENT_ID on the API.",
      );
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      const challenge = await api.createAppleChallenge();
      const identityToken = await requestAppleIdentityToken(challenge, configuration);
      const response = await api.exchangeAppleIdentityToken(challenge.challengeID, identityToken);
      const nextSession = { token: response.sessionToken, expiresAt: response.expiresAt };
      saveSession(nextSession);
      setSession(nextSession);
      queryClient.clear();
      return true;
    } catch (cause) {
      setError(appleSignInError(cause));
      return false;
    } finally {
      setBusy(false);
    }
  }, [configuration]);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      await api.logout();
    } catch {
      setError(
        "This browser was signed out, but the API could not confirm revocation. The server session will expire automatically.",
      );
    } finally {
      clearSession();
      setSession(null);
      queryClient.clear();
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      busy,
      error,
      configurationReady: configuration !== null,
      signIn,
      signOut,
      clearError: () => setError(null),
    }),
    [session, busy, error, configuration, signIn, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
