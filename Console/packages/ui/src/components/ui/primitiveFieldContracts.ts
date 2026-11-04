import type { GemColorToken, GemDateFormat, GemNumberFormat, GemSelectOption } from "../../presentationTypes";

/** Primitive field kinds supported by the shared G field layer. */
export type GemPrimitiveType =
  "id" | "text" | "number" | "url" | "email" | "phone" | "date" | "image" | "select" | "status" | "checkbox" | "media";

export interface GemPrimitiveBaseContract {
  primitive: GemPrimitiveType;
  required?: boolean;
  nullable?: boolean;
  placeholder?: string;
}

export interface GemTextPrimitiveContract extends GemPrimitiveBaseContract {
  primitive: "text" | "url" | "email" | "phone";
}

export interface GemNumberPrimitiveContract extends GemPrimitiveBaseContract {
  primitive: "number";
  numberFormat?: GemNumberFormat;
  min?: number;
  max?: number;
  step?: number | string;
}

export interface GemDatePrimitiveContract extends GemPrimitiveBaseContract {
  primitive: "date";
  dateFormat?: GemDateFormat;
}

export interface GemSelectPrimitiveContract extends GemPrimitiveBaseContract {
  primitive: "select" | "status";
  options: GemSelectOption[];
  colorToken?: GemColorToken;
}

export type GemPrimitiveFieldContract =
  | GemTextPrimitiveContract
  | GemNumberPrimitiveContract
  | GemDatePrimitiveContract
  | GemSelectPrimitiveContract
  | (GemPrimitiveBaseContract & { primitive: "checkbox" | "media" });
