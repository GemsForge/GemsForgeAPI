import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { queryClient } from "../data/queryClient";
import { AuthProvider } from "./AuthProvider";
import { SignInPage } from "./SignInPage";
import { TamaguiProvider } from "tamagui";
import { tamaguiConfig } from "../design-system";

function render(ui: React.ReactElement) {
  return rtlRender(<TamaguiProvider config={tamaguiConfig}>{ui}</TamaguiProvider>);
}

const localSignIn = vi.hoisted(() => vi.fn());

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  localSignIn.mockReset();
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

describe("local sign-in page", () => {
  it("exchanges local credentials for an API session and opens protected content", async () => {
    localSignIn.mockResolvedValue({
      sessionToken: "opaque-api-session-token",
      expiresAt: "2099-01-01T00:00:00Z",
    });
    vi.spyOn(api, "localSignIn").mockImplementation(localSignIn);

    renderSignIn();
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "gemsforge" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "owner-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Protected workspace")).toBeInTheDocument();
    expect(api.localSignIn).toHaveBeenCalledWith("gemsforge", "owner-password");
    await waitFor(() =>
      expect(JSON.parse(window.sessionStorage.getItem("gem-life.session.v1") ?? "{}")).toEqual({
        token: "opaque-api-session-token",
        expiresAt: "2099-01-01T00:00:00Z",
      }),
    );
  });

  it("keeps signup disabled and identifies local credential setup", () => {
    renderSignIn();
    expect(screen.getByRole("button", { name: "Sign in" })).not.toBeDisabled();
    expect(screen.getByText(/Account creation is disabled/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /create account/i })).not.toBeInTheDocument();
  });

  it("presents provider and API failures as actionable sign-in errors", async () => {
    localSignIn.mockRejectedValue(new Error("Username or password is incorrect."));
    vi.spyOn(api, "localSignIn").mockImplementation(localSignIn);
    renderSignIn();
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "gemsforge" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Username or password is incorrect.");
  });
});
