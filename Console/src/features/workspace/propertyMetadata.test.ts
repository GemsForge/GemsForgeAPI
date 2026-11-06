import { describe, expect, it } from "vitest";
import { ArrowUpRight, DollarSign, Link, ListFilter, Percent, Search } from "lucide-react";
import { inferWireframePropertyMetadata } from "./propertyMetadata";
import { inferWireframePropertyType, PROPERTY_ICON_LIBRARY } from "./propertyIcons";

describe("wireframe property metadata", () => {
  it.each([
    ["Institution type", "text", "Select"],
    ["Due", "text", "Select"],
    ["Occurrence", undefined, "Select"],
    ["Current status", "text", "Status"],
    ["Start date", undefined, "Date"],
    ["Website", "text", "URL"],
    ["Monthly amount", "number", "Currency"],
    ["Paid price", "number", "Currency"],
    ["Interest rate", "number", "Percent"],
    ["APR", "number", "Percent"],
    ["Quantity", "number", "Number"],
    ["Notes", "text", "Notes"],
    ["Tags", "text", "Multi-select"],
    ["Category", "relation", "Relation"],
    ["Category name", "lookup", "Lookup"],
  ])("infers %s as %s", (label, kind, expected) => {
    expect(inferWireframePropertyType(label, kind)).toBe(expected);
  });

  it("uses explicit metadata before label fallbacks", () => {
    expect(
      inferWireframePropertyMetadata({
        label: "Website",
        kind: "url",
        propertyType: "Text",
        iconName: "Lock",
      }),
    ).toEqual({ type: "Text", iconName: "Lock" });
    expect(inferWireframePropertyType("Monthly amount", "number", "decimal")).toBe("Number");
    expect(inferWireframePropertyMetadata({ label: "Address", kind: "relation" }).iconName).toBe("Relation");
    expect(inferWireframePropertyType("Logo", "image")).toBe("Image");
  });

  it.each(["ID", "Item ID", "Record ID", "Primary Key"])("defaults %s to the Lock icon", (label) => {
    expect(inferWireframePropertyMetadata({ label }).iconName).toBe("Lock");
  });

  it.each([
    ["Monthly amount", "number", undefined, "Currency"],
    ["APR", "number", undefined, "Percent"],
    ["Website", "url", undefined, "URL"],
    ["Category type", "select", undefined, "Select"],
  ])("chooses the matching icon for %s", (label, kind, numberFormat, iconName) => {
    expect(inferWireframePropertyMetadata({ label, kind, numberFormat }).iconName).toBe(iconName);
  });

  it("uses the requested Lucide icon defaults", () => {
    expect(PROPERTY_ICON_LIBRARY.find((icon) => icon.name === "Currency")?.icon).toBe(DollarSign);
    expect(PROPERTY_ICON_LIBRARY.find((icon) => icon.name === "Percent")?.icon).toBe(Percent);
    expect(PROPERTY_ICON_LIBRARY.find((icon) => icon.name === "URL")?.icon).toBe(Link);
    expect(PROPERTY_ICON_LIBRARY.find((icon) => icon.name === "Select")?.icon).toBe(ListFilter);
    expect(PROPERTY_ICON_LIBRARY.find((icon) => icon.name === "Relation")?.icon).toBe(ArrowUpRight);
    expect(PROPERTY_ICON_LIBRARY.find((icon) => icon.name === "Lookup")?.icon).toBe(Search);
  });
});
