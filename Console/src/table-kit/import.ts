/** Describes a validation failure associated with one imported record. */
export interface ImportFieldError {
  row: number;
  field?: string;
  message: string;
}

/** Contains successfully parsed rows and any row- or field-level errors. */
export interface ImportPreview<Row> {
  rows: readonly Row[];
  errors: readonly ImportFieldError[];
}

/** Maps an imported CSV column to a table field and optional parser. */
export interface ImportColumn {
  id: string;
  parse?: (value: string, row: number) => unknown;
}

/** Parses RFC-4180-style CSV, preserving embedded delimiters and line breaks. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let afterQuote = false;
  let lineHasContent = false;

  const finishCell = () => {
    row.push(cell);
    cell = "";
    afterQuote = false;
  };
  const finishRow = () => {
    finishCell();
    if (lineHasContent || row.some((value) => value.length > 0)) rows.push(row);
    row = [];
    lineHasContent = false;
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else {
        cell += character;
      }
      continue;
    }

    if (afterQuote && character !== "," && character !== "\r" && character !== "\n" && character.trim() !== "") {
      throw new Error(`Unexpected character after closing quote at row ${rows.length + 1}`);
    }
    if (character === '"') {
      if (cell.length > 0) throw new Error(`Unexpected quote in unquoted field at row ${rows.length + 1}`);
      quoted = true;
      lineHasContent = true;
    } else if (character === ",") {
      finishCell();
      lineHasContent = true;
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      finishRow();
    } else {
      cell += character;
      if (character.trim() !== "") lineHasContent = true;
    }
  }
  if (quoted) throw new Error(`Unclosed quoted field at row ${rows.length + 1}`);
  if (row.length > 0 || cell.length > 0 || lineHasContent || afterQuote) finishRow();
  return rows;
}

/** Parses and validates a JSON array whose entries are objects. */
export function parseJson(text: string): unknown[] {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed) || parsed.some((row) => row === null || typeof row !== "object" || Array.isArray(row))) {
    throw new Error("JSON import must be an array of objects");
  }
  return parsed;
}

/** Parses CSV text and applies the table schema to each record. */
export function previewCsv<Row>(text: string, columns: readonly ImportColumn[]): ImportPreview<Row> {
  let parsed: string[][];
  try {
    parsed = parseCsv(text);
  } catch (error) {
    return { rows: [], errors: [{ row: 0, message: error instanceof Error ? error.message : "Malformed CSV" }] };
  }
  const [header = [], ...records] = parsed;
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

/** Parses JSON text and validates each record with the supplied callback. */
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
