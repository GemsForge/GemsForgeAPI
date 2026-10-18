export interface BrowserSession {
  token: string;
  expiresAt: string;
}

const SESSION_KEY = "gem-life.session.v1";
export const SESSION_EXPIRED_EVENT = "gem-life:session-expired";

function isValidSession(value: unknown): value is BrowserSession {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BrowserSession>;
  return (
    typeof candidate.token === "string" &&
    candidate.token.length > 0 &&
    typeof candidate.expiresAt === "string" &&
    Number.isFinite(Date.parse(candidate.expiresAt)) &&
    Date.parse(candidate.expiresAt) > Date.now()
  );
}

/** Keep the bearer token in this tab's session storage; never in a URL or localStorage. */
export function readSession(): BrowserSession | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (isValidSession(value)) return value;
    notifySessionExpired();
  } catch {
    // Storage may be disabled or contain malformed data. Treat that as signed out.
  }
  clearSession();
  return null;
}

export function saveSession(session: BrowserSession): void {
  if (!isValidSession(session)) throw new Error("The API returned an invalid or expired session.");
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // The in-memory UI still signs out if browser storage is unavailable.
  }
}

export function getBearerToken(): string | null {
  return readSession()?.token ?? null;
}

export function notifySessionExpired(): void {
  clearSession();
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}
