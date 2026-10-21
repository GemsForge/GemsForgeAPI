export interface ImportFieldError {
  row: number;
  field?: string;
  message: string;
}

export interface ImportPreview<Row> {
  rows: readonly Row[];
  errors: readonly ImportFieldError[];
}

export interface ImportColumn {
  id: string;
  parse?: (value: string, row: number) => unknown;
}

export function parseCsv(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split(",").map((cell) => cell.trim()));
}

export function parseJson(text: string): unknown[] {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed) || parsed.some((row) => row === null || typeof row !== "object" || Array.isArray(row))) {
    throw new Error("JSON import must be an array of objects");
  }
  return parsed;
}

export function previewCsv<Row>(text: string, columns: readonly ImportColumn[]): ImportPreview<Row> {
  const [header = [], ...records] = parseCsv(text);
  const errors: ImportFieldError[] = [];
  const rows: Row[] = [];
  records.forEach((record, index) => {
    const row = {} as Row;
    columns.forEach((column, columnIndex) => {
      const value = record[columnIndex] ?? "";
      try {
        (row as Record<string, unknown>)[column.id] = column.parse?.(value, index + 2) ?? value;
      } catch (error) {
        errors.push({
          row: index + 2,
          field: column.id,
          message: error instanceof Error ? error.message : "Invalid value",
        });
      }
    });
    if (header.length !== columns.length) errors.push({ row: 1, message: "CSV header does not match the schema" });
    rows.push(row);
  });
  return { rows, errors };
}

export function previewJson<Row>(text: string, validate: (value: unknown, row: number) => Row): ImportPreview<Row> {
  const rows: Row[] = [];
  const errors: ImportFieldError[] = [];
  try {
    parseJson(text).forEach((value, index) => {
      try {
        rows.push(validate(value, index + 1));
      } catch (error) {
        errors.push({ row: index + 1, message: error instanceof Error ? error.message : "Invalid record" });
      }
    });
  } catch (error) {
    errors.push({ row: 0, message: error instanceof Error ? error.message : "Invalid JSON" });
  }
  return { rows, errors };
}
