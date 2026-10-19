import { afterEach, describe, expect, it } from "vitest";
import { clearSession, getBearerToken, readSession, saveSession } from "./session";

afterEach(() => {
  clearSession();
  window.localStorage.clear();
});

describe("browser API session storage", () => {
  it("keeps the opaque token in tab-scoped session storage only", () => {
    const session = { token: "opaque-secret", expiresAt: new Date(Date.now() + 60_000).toISOString() };
    saveSession(session);
    expect(getBearerToken()).toBe("opaque-secret");
    expect(readSession()).toEqual(session);
    expect(window.localStorage.length).toBe(0);
    expect(window.location.href).not.toContain(session.token);
  });

  it("discards expired and malformed sessions", () => {
    window.sessionStorage.setItem(
      "gem-life.session.v1",
      JSON.stringify({ token: "expired", expiresAt: new Date(Date.now() - 1000).toISOString() }),
    );
    expect(readSession()).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
    window.sessionStorage.setItem("gem-life.session.v1", "not-json");
    expect(readSession()).toBeNull();
  });
});
