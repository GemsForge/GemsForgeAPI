import { useState, type FormEvent } from "react";
import { GemButton } from "@gemsforge/ui";
import { useCreateSchemaPageRecordMutation } from "../../data/workflowQueries";
import type { SchemaPageTable } from "../../types";
import type { TableNewRecordUtilityOption } from "../../table-kit/types";
import { RecordImport } from "../../components/RecordImport";

function SchemaRecordForm({ table, close }: { table: SchemaPageTable; close: () => void }) {
  const mutation = useCreateSchemaPageRecordMutation(table.name);
  const columns = table.columns.filter((column) => column.name !== "HubID" && !column.primaryKey);
  const [values, setValues] = useState<Record<string, string>>({});

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const record = Object.fromEntries(
      columns.flatMap((column) => {
        const value = values[column.name] ?? "";
        if (!value && column.defaultValue !== null) return [];
        return [[column.name, value === "" && column.nullable ? null : value]];
      }),
    );
    try {
      await mutation.mutateAsync(record);
      close();
    } catch {
      // TanStack mutation state renders the server validation message below.
    }
  };

  return (
    <form className="create-record-form" onSubmit={(event) => void submit(event)} aria-busy={mutation.isPending}>
      {columns.some(
        (column) => column.dataType.toUpperCase().includes("BLOB") && !column.nullable && column.defaultValue === null,
      ) ? (
        <p role="alert">
          This table has a required binary property. Use its dedicated file workflow to create records.
        </p>
      ) : null}
      {columns.map((column) => (
        <label className="database-field" key={column.name}>
          {column.name}
          {column.dataType.toUpperCase().includes("BLOB") ? (
            <span className="field-hint">Binary data is not supported by this form.</span>
          ) : (
            <input
              className="create-form-control"
              aria-label={column.name}
              required={!column.nullable && column.defaultValue === null}
              type={
                column.dataType.toUpperCase().includes("INT") || /REAL|NUMERIC|DECIMAL|FLOAT/i.test(column.dataType)
                  ? "number"
                  : "text"
              }
              step={/REAL|NUMERIC|DECIMAL|FLOAT/i.test(column.dataType) ? "any" : undefined}
              value={values[column.name] ?? ""}
              disabled={mutation.isPending}
              onChange={(event) => setValues((current) => ({ ...current, [column.name]: event.target.value }))}
            />
          )}
        </label>
      ))}
      {mutation.isError ? <p role="alert">{mutation.error.message}</p> : null}
      <GemButton
        type="submit"
        disabled={
          mutation.isPending ||
          columns.some(
            (column) =>
              column.dataType.toUpperCase().includes("BLOB") && !column.nullable && column.defaultValue === null,
          )
        }
      >
        {mutation.isPending ? "Saving…" : "Create record"}
      </GemButton>
    </form>
  );
}

export function createSchemaRecordOptions(table: SchemaPageTable): TableNewRecordUtilityOption[] {
  return [
    {
      id: "schema-record-create",
      label: "New record",
      description: `Add one record to ${table.name}.`,
      render: ({ close }) => <SchemaRecordForm table={table} close={close} />,
    },
    ...(["file", "paste"] as const).map((mode) => ({
      id: `schema-record-import-${mode}`,
      label: mode === "file" ? "Import File" : "Paste data",
      description: mode === "file" ? "Choose a CSV or JSON file." : "Paste CSV or JSON records.",
      render: ({ close }: { close: () => void }) => (
        <RecordImport
          label={table.name}
          expectedColumns={[]}
          mode={mode}
          open
          showTrigger={false}
          onOpenChange={(open) => !open && close()}
          schemaTable={table}
        />
      ),
    })),
  ];
}
