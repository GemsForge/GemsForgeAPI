/** Shared value types used by UI controls and presentation adapters. */
export type GemNumberFormat = "decimal" | "currency" | "percent";
export type GemDateFormat = "iso" | "local" | "relative";
export type GemColorToken = "mint" | "gold" | "blue" | "green" | "purple" | "orange" | "red" | "gray";

export interface GemSelectOption {
  label: string;
  value: string;
  colorToken?: GemColorToken;
  isDefault?: boolean;
  group?: string;
}
