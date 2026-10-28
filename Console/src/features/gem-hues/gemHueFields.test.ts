import { describe, expect, it, vi } from "vitest";
import type { GemHue } from "../../types";
import { gemHueFieldDefinitions } from "./gemHueFields";
import { gemHueEditableFields } from "./gemHueRecordFields";

describe("Gem Hue property contract", () => {
  it("uses the create properties and select options in the record editor", async () => {
    const record = {
      id: "HUE-0006", colorName: "Amber Glow", colorFamily: "Orange", hexCode: "#FFA62B",
      mood: "Playful", palette: "Legacy palette", description: null, createdDate: null, notes: null,
    } satisfies GemHue;
    const onPatch = vi.fn().mockResolvedValue(undefined);
    const fields = gemHueEditableFields(record, onPatch);

    expect(fields.map((field) => field.label)).toEqual(
      gemHueFieldDefinitions.filter((field) => field.name !== "id").map((field) => field.label),
    );
    expect(fields.find((field) => field.label === "Color family")?.options).toContainEqual({ value: "Orange", label: "Orange" });
    expect(fields.find((field) => field.label === "Palette")?.options).toContainEqual({ value: "Legacy palette", label: "Legacy palette" });
    expect(fields.find((field) => field.label === "Created date")?.primitive).toBe("date");

    await fields.find((field) => field.label === "Hex code")?.onSave?.("#123456");
    expect(onPatch).toHaveBeenCalledWith({ hexCode: "#123456" });
  });
});
