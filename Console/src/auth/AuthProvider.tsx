import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api";
import { queryClient } from "../data/queryClient";
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
  signIn: (username: string, password: string) => Promise<boolean>;
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

  const signIn = useCallback(async (username: string, password: string) => {
    setBusy(true);
    setError(null);
    try {
      const response = await api.localSignIn(username, password);
      const nextSession = { token: response.sessionToken, expiresAt: response.expiresAt };
      saveSession(nextSession);
      setSession(nextSession);
      queryClient.clear();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in could not be completed. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

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
      configurationReady: true,
      signIn,
      signOut,
      clearError: () => setError(null),
    }),
    [session, busy, error, signIn, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
