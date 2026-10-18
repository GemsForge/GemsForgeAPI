import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { AuthProvider, useAuth } from "./AuthProvider";
import { clearSession, saveSession, SESSION_EXPIRED_EVENT } from "./session";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  clearSession();
});

function SessionControls() {
  const auth = useAuth();
  return (
    <>
      <p>{auth.session ? "Signed in" : "Signed out"}</p>
      {auth.error && <p role="alert">{auth.error}</p>}
      <button onClick={() => void auth.signOut()}>Sign out</button>
    </>
  );
}

function renderProvider() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <SessionControls />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("API session lifecycle", () => {
  it("revokes the API session and clears browser session state on sign out", async () => {
    saveSession({ token: "opaque-session", expiresAt: "2099-01-01T00:00:00Z" });
    vi.spyOn(api, "logout").mockResolvedValue();
    renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(screen.getByText("Signed out")).toBeInTheDocument());
    expect(api.logout).toHaveBeenCalledOnce();
    expect(window.sessionStorage.length).toBe(0);
  });

  it("returns to signed-out state and clears cached data when the session expires", async () => {
    saveSession({ token: "expired-session", expiresAt: "2099-01-01T00:00:00Z" });
    renderProvider();
    act(() => window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT)));
    await waitFor(() => expect(screen.getByText("Signed out")).toBeInTheDocument());
    expect(window.sessionStorage.length).toBe(0);
    expect(screen.getByRole("alert")).toHaveTextContent("expired or was revoked");
  });

  it("explains an expired session restored from the current tab after reload", () => {
    window.sessionStorage.setItem(
      "gem-life.session.v1",
      JSON.stringify({ token: "old-session", expiresAt: new Date(Date.now() - 60_000).toISOString() }),
    );
    renderProvider();
    expect(screen.getByText("Signed out")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("expired or was revoked");
    expect(window.sessionStorage.length).toBe(0);
  });
});
