import { describe, expect, it } from "vitest";
import { APIError } from "../api";
import { presentError } from "./errorPresentation";

describe("presentError", () => {
  it.each([
    [0, "The local API is unavailable.", true],
    [404, "requested record could not be found", false],
    [422, "information is invalid", false],
    [409, "conflicts with a newer version", true],
    [500, "encountered a problem", true],
  ])("maps HTTP %s to safe copy", (status, message, canRetry) => {
    const result = presentError(new APIError("raw server details", status));
    expect(result.message).toContain(message);
    expect(result.message).not.toContain("raw server details");
    expect(result.canRetry).toBe(canRetry);
  });

  it("uses a safe fallback for unknown failures", () => {
    expect(presentError(new Error("database password leaked")).message).not.toContain("database password");
  });
});
