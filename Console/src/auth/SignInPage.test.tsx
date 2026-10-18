import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { queryClient } from "../data/queryClient";
import { AuthProvider } from "./AuthProvider";
import { SignInPage } from "./SignInPage";

const requestSupabaseAccessToken = vi.hoisted(() => vi.fn());
const getSupabaseSignInConfiguration = vi.hoisted(() => vi.fn());
vi.mock("./supabaseSignIn", () => ({
  getSupabaseSignInConfiguration,
  requestSupabaseAccessToken,
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  requestSupabaseAccessToken.mockReset();
  getSupabaseSignInConfiguration.mockReset();
  window.sessionStorage.clear();
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

describe("Supabase sign-in page", () => {
  it("exchanges Supabase credentials for an API session and opens protected content", async () => {
    getSupabaseSignInConfiguration.mockReturnValue({
      url: "https://gemlife.supabase.co",
      publishableKey: "public-test-key",
    });
    requestSupabaseAccessToken.mockResolvedValue("short-lived-supabase-access-token");
    vi.spyOn(api, "exchangeSupabaseIdentityToken").mockResolvedValue({
      sessionToken: "opaque-api-session-token",
      expiresAt: "2099-01-01T00:00:00Z",
    });

    renderSignIn();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "owner@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "owner-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Protected workspace")).toBeInTheDocument();
    expect(requestSupabaseAccessToken).toHaveBeenCalledWith("owner@example.com", "owner-password");
    expect(api.exchangeSupabaseIdentityToken).toHaveBeenCalledWith("short-lived-supabase-access-token");
    await waitFor(() =>
      expect(JSON.parse(window.sessionStorage.getItem("gem-life.session.v1") ?? "{}")).toEqual({
        token: "opaque-api-session-token",
        expiresAt: "2099-01-01T00:00:00Z",
      }),
    );
    expect(window.sessionStorage.getItem("gem-life.session.v1")).not.toContain("short-lived-supabase");
  });

  it("keeps signup disabled and explains missing project configuration", () => {
    getSupabaseSignInConfiguration.mockReturnValue(null);
    renderSignIn();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    expect(screen.getByLabelText("Sign-in setup required")).toHaveTextContent(/VITE_SUPABASE_URL/);
    expect(screen.getByText(/Account creation is disabled/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /create account/i })).not.toBeInTheDocument();
  });

  it("presents provider and API failures as actionable sign-in errors", async () => {
    getSupabaseSignInConfiguration.mockReturnValue({
      url: "https://gemlife.supabase.co",
      publishableKey: "public-test-key",
    });
    requestSupabaseAccessToken.mockRejectedValue(new Error("Email or password is incorrect."));
    renderSignIn();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "owner@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect.");
  });
});
