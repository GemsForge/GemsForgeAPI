import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { TamaguiProvider } from "tamagui";
import { afterEach, describe, expect, it, vi } from "vitest";
import { tamaguiConfig } from "../../design-system";
import {
  addressValuesFromGeoapify,
  createGeoapifySearchClient,
  GeoapifyAddressSearch,
  type GeoapifySuggestion,
} from "./GeoapifyAddressSearch";

function renderWithTamagui(ui: ReactElement) {
  return render(<TamaguiProvider config={tamaguiConfig} defaultTheme="dark">{ui}</TamaguiProvider>);
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("Geoapify address search", () => {
  it("maps only available structured address fields", () => {
    expect(
      addressValuesFromGeoapify({
        address_line1: "1600 Pennsylvania Avenue NW",
        city: "Washington",
        state_code: "DC",
        postcode: "20500",
        country_code: "US",
      }),
    ).toEqual({
      addressLine1: "1600 Pennsylvania Avenue NW",
      city: "Washington",
      state: "DC",
      postalCode: "20500",
      country: "US",
    });
    expect(addressValuesFromGeoapify({ city: "Washington" })).toEqual({ city: "Washington" });
  });

  it("requests address suggestions and exposes required attribution", async () => {
    vi.useFakeTimers();
    const suggestion: GeoapifySuggestion = {
      properties: {
        formatted: "1600 Pennsylvania Avenue NW, Washington, DC 20500, United States",
        address_line1: "1600 Pennsylvania Avenue NW",
        city: "Washington",
        state_code: "DC",
        postcode: "20500",
        country_code: "us",
        datasource: { attribution: "© OpenStreetMap contributors" },
      },
    };
    const client = { autocomplete: vi.fn().mockResolvedValue([suggestion]) };
    const onSelect = vi.fn();
    renderWithTamagui(<GeoapifyAddressSearch client={client} onSelect={onSelect} />);

    fireEvent.change(screen.getByLabelText("Search places or addresses"), { target: { value: "1600 Pennsylvania" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(client.autocomplete).toHaveBeenCalledWith("1600 Pennsylvania", expect.any(AbortSignal));
    expect(screen.getByRole("link", { name: "Powered by Geoapify" })).toHaveAttribute(
      "href",
      "https://www.geoapify.com/",
    );
    expect(screen.getByRole("link", { name: "© OpenStreetMap contributors" })).toHaveAttribute(
      "href",
      "https://www.openstreetmap.org/copyright",
    );
    fireEvent.click(screen.getByRole("button", { name: suggestion.properties.formatted }));
    expect(onSelect).toHaveBeenCalledWith({
      addressLine1: "1600 Pennsylvania Avenue NW",
      city: "Washington",
      state: "DC",
      postalCode: "20500",
      country: "US",
    });
  });

  it("debounces eligible queries and does not request blank or short input", async () => {
    vi.useFakeTimers();
    const client = { autocomplete: vi.fn().mockResolvedValue([]) };
    renderWithTamagui(<GeoapifyAddressSearch client={client} onSelect={vi.fn()} />);
    const input = screen.getByLabelText("Search places or addresses");

    fireEvent.change(input, { target: { value: "  " } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    fireEvent.change(input, { target: { value: "NY" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(client.autocomplete).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "NYC" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(349);
    });
    expect(client.autocomplete).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(client.autocomplete).toHaveBeenCalledTimes(1);
    expect(client.autocomplete).toHaveBeenCalledWith("NYC", expect.any(AbortSignal));
  });

  it("explains missing provider configuration and keeps the search unavailable", () => {
    vi.stubEnv("VITE_GEOAPIFY_API_KEY", "");
    renderWithTamagui(<GeoapifyAddressSearch onSelect={vi.fn()} />);

    expect(screen.getByLabelText("Search places or addresses")).toBeDisabled();
    expect(screen.getByLabelText("Address search")).toHaveTextContent("Configure VITE_GEOAPIFY_API_KEY");
    expect(screen.getByLabelText("Address search")).toHaveTextContent("You can still enter the address manually.");
  });

  it("shows loading and no-results feedback", async () => {
    vi.useFakeTimers();
    let resolveSearch!: (suggestions: GeoapifySuggestion[]) => void;
    const client = {
      autocomplete: vi.fn(
        () =>
          new Promise<GeoapifySuggestion[]>((resolve) => {
            resolveSearch = resolve;
          }),
      ),
    };
    renderWithTamagui(<GeoapifyAddressSearch client={client} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Search places or addresses"), { target: { value: "Seattle" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Searching addresses");

    await act(async () => {
      resolveSearch([]);
    });
    expect(screen.getByRole("status")).toHaveTextContent("No address matches found");
    expect(screen.getByText(/You can enter the address manually/)).toBeInTheDocument();
  });

  it.each([
    ["request limits", "Address search has reached its request limit."],
    ["provider failures", "Address search is temporarily unavailable."],
  ])("shows understandable feedback for %s", async (_case, message) => {
    vi.useFakeTimers();
    const client = { autocomplete: vi.fn().mockRejectedValue(new Error(message)) };
    renderWithTamagui(<GeoapifyAddressSearch client={client} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Search places or addresses"), { target: { value: "Boston" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("link", { name: "Powered by Geoapify" })).toBeInTheDocument();
  });

  it("uses the autocomplete endpoint with a safely encoded key and query", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [{ properties: { city: "New York" } }] }),
    });
    const client = createGeoapifySearchClient("restricted key", request as unknown as typeof fetch);

    await expect(client.autocomplete("New York")).resolves.toEqual([{ properties: { city: "New York" } }]);
    const [url] = request.mock.calls[0] as [string];
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://api.geoapify.com");
    expect(parsed.pathname).toBe("/v1/geocode/autocomplete");
    expect(parsed.searchParams.get("text")).toBe("New York");
    expect(parsed.searchParams.get("apiKey")).toBe("restricted key");
    expect(parsed.searchParams.get("limit")).toBe("5");
  });

  it("reports request limits while leaving manual entry available", async () => {
    const request = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    const client = createGeoapifySearchClient("key", request as unknown as typeof fetch);
    await expect(client.autocomplete("Boston")).rejects.toThrow("reached its request limit");
  });
});
