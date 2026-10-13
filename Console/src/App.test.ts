import { describe, expect, it } from "vitest";
import { viewForPath } from "./App";

describe("Gem Life routes", () => {
  it.each([
    ["/gemhues", "hues"],
    ["/education", "education"],
    ["/employment", "employment"],
    ["/addresses", "addresses"],
    ["/transactions", "transactions"],
    ["/local-databases", "databases"],
    ["/schema-builder", "schema"],
    ["/forgekeeper", "pages"],
  ])("maps %s to the %s view", (path, expectedView) => {
    expect(viewForPath(path)).toBe(expectedView);
  });
});
