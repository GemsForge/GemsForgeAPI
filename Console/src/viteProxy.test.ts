import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// An unproxied API path silently returns the dev server's index.html, so the
// request "succeeds" with HTML and the query fails JSON parsing.
const apiSource = readFileSync(resolve(__dirname, "api.ts"), "utf8");
const viteSource = readFileSync(resolve(__dirname, "../vite.config.ts"), "utf8");

describe("Vite dev proxy", () => {
  it("forwards every top-level API path the Console requests", () => {
    const requested = new Set(
      [...apiSource.matchAll(/request(?:<[^>]*>)?\(\s*[`"](\/[a-z][a-z-]*)/g)].map((match) => match[1]),
    );
    const proxied = new Set([...viteSource.matchAll(/^\s*"(\/[a-z][a-z-]*)",$/gm)].map((match) => match[1]));

    expect(requested.size).toBeGreaterThan(10);
    expect([...requested].filter((path) => !proxied.has(path))).toEqual([]);
  });
});
