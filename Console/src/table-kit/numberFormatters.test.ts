import { describe, expect, it } from "vitest";
import { formatRecordNumber, inferRecordNumberFormat } from "./numberFormatters";

describe("number formatters", () => {
  it("maps semantic property names to units", () => {
    expect(inferRecordNumberFormat("monthlyAmount")).toBe("currency");
    expect(inferRecordNumberFormat("apr", "APR")).toBe("percent");
    expect(inferRecordNumberFormat("quantity")).toBe("decimal");
  });

  it("preserves percentage-point storage semantics", () => {
    expect(formatRecordNumber(4.5, "percent")).toBe("4.5%");
  });
});
