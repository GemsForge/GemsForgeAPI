import { decodeMultiSelectValue } from "@gemsforge/ui";

/** Matches one complete, case-sensitive tag after trimming and NFC normalization. */
export function matchesMultiSelectOption(value: string, option: string): boolean {
  const expected = option.trim().normalize("NFC");
  if (!expected) return false;
  return decodeMultiSelectValue(value).some((tag) => tag.trim().normalize("NFC") === expected);
}
