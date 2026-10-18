import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addressValuesFromGeoapify,
  createGeoapifySearchClient,
  GeoapifyAddressSearch,
  type GeoapifySuggestion,
} from "./GeoapifyAddressSearch";

afterEach(() => {
  vi.useRealTimers();
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
    render(<GeoapifyAddressSearch client={client} onSelect={onSelect} />);

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
