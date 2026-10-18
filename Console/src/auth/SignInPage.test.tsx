import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { queryClient } from "../data/queryClient";
import { AuthProvider } from "./AuthProvider";
import { SignInPage } from "./SignInPage";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  window.sessionStorage.clear();
  delete (window as Window & { AppleID?: unknown }).AppleID;
  document.querySelectorAll('script[src*="appleid.auth.js"]').forEach((script) => script.remove());
});

function renderSignIn() {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<SignInPage />} />
            <Route path="*" element={<p>Protected workspace</p>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("Sign in with Apple page", () => {
  it("requests a nonce, validates Apple's state, exchanges the identity token, and opens protected content", async () => {
    vi.stubEnv("VITE_APPLE_CLIENT_ID", "com.example.gemlife");
    vi.stubEnv("VITE_APPLE_REDIRECT_URI", "https://gem-life.example.com/auth/callback");
    vi.spyOn(api, "createAppleChallenge").mockResolvedValue({
      challengeID: "one-time-challenge",
      nonce: "server-nonce",
      expiresAt: "2099-01-01T00:00:00Z",
    });
    vi.spyOn(api, "exchangeAppleIdentityToken").mockResolvedValue({
      accountID: "server-owned-account",
      sessionToken: "opaque-session-token",
      expiresAt: "2099-01-01T00:00:00Z",
    });
    let appleState = "";
    const init = vi.fn((options: { state: string }) => {
      appleState = options.state;
    });
    Object.defineProperty(window, "AppleID", {
      configurable: true,
      value: {
        auth: {
          init,
          signIn: vi.fn(async () => ({ authorization: { id_token: "signed-apple-token", state: appleState } })),
        },
      },
    });

    renderSignIn();
    fireEvent.click(screen.getByRole("button", { name: "Continue with Apple" }));

    expect(await screen.findByText("Protected workspace")).toBeInTheDocument();
    expect(init).toHaveBeenCalledWith({
      clientId: "com.example.gemlife",
      scope: "",
      redirectURI: "https://gem-life.example.com/auth/callback",
      state: expect.any(String),
      nonce: "server-nonce",
      usePopup: true,
    });
    expect(api.exchangeAppleIdentityToken).toHaveBeenCalledWith("one-time-challenge", "signed-apple-token");
    await waitFor(() =>
      expect(JSON.parse(window.sessionStorage.getItem("gem-life.session.v1") ?? "{}")).toEqual({
        token: "opaque-session-token",
        expiresAt: "2099-01-01T00:00:00Z",
      }),
    );
    expect(window.sessionStorage.getItem("gem-life.session.v1")).not.toContain("server-owned-account");
  });

  it("explains missing client configuration and rejects local or insecure Apple redirect URIs", () => {
    vi.stubEnv("VITE_APPLE_CLIENT_ID", "com.example.gemlife");
    vi.stubEnv("VITE_APPLE_REDIRECT_URI", "http://127.0.0.1:5173/callback");
    renderSignIn();
    expect(screen.getByRole("button", { name: "Continue with Apple" })).toBeDisabled();
    expect(screen.getByLabelText("Sign-in setup required")).toHaveTextContent(
      /registered HTTPS VITE_APPLE_REDIRECT_URI/,
    );
  });

  it("presents API/provider failures as actionable sign-in errors", async () => {
    vi.stubEnv("VITE_APPLE_CLIENT_ID", "com.example.gemlife");
    vi.stubEnv("VITE_APPLE_REDIRECT_URI", "https://gem-life.example.com/auth/callback");
    vi.spyOn(api, "createAppleChallenge").mockRejectedValue(new Error("Apple authentication is not configured."));
    renderSignIn();
    fireEvent.click(screen.getByRole("button", { name: "Continue with Apple" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Apple authentication is not configured.");
  });

  it("explains a cancelled Apple popup without attempting the token exchange", async () => {
    vi.stubEnv("VITE_APPLE_CLIENT_ID", "com.example.gemlife");
    vi.stubEnv("VITE_APPLE_REDIRECT_URI", "https://gem-life.example.com/auth/callback");
    vi.spyOn(api, "createAppleChallenge").mockResolvedValue({
      challengeID: "challenge",
      nonce: "nonce",
      expiresAt: "2099-01-01T00:00:00Z",
    });
    const signIn = vi.fn().mockRejectedValue({ error: "popup_closed_by_user" });
    Object.defineProperty(window, "AppleID", {
      configurable: true,
      value: { auth: { init: vi.fn(), signIn } },
    });
    const exchange = vi.spyOn(api, "exchangeAppleIdentityToken");
    renderSignIn();
    fireEvent.click(screen.getByRole("button", { name: "Continue with Apple" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sign-in was cancelled");
    expect(exchange).not.toHaveBeenCalled();
  });

  it("shows a recoverable message when Apple's hosted sign-in script cannot load", async () => {
    vi.stubEnv("VITE_APPLE_CLIENT_ID", "com.example.gemlife");
    vi.stubEnv("VITE_APPLE_REDIRECT_URI", "https://gem-life.example.com/auth/callback");
    vi.spyOn(api, "createAppleChallenge").mockResolvedValue({
      challengeID: "challenge",
      nonce: "nonce",
      expiresAt: "2099-01-01T00:00:00Z",
    });
    renderSignIn();
    fireEvent.click(screen.getByRole("button", { name: "Continue with Apple" }));
    await waitFor(() => expect(document.querySelector('script[src*="appleid.auth.js"]')).not.toBeNull());
    fireEvent.error(document.querySelector('script[src*="appleid.auth.js"]')!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Apple’s sign-in service could not be loaded");
  });
});
