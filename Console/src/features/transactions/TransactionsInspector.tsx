import { useState } from "react";
import { GemButton, GSearchField } from "@gemsforge/ui";
import type { ExpenseTransaction, RelatedRecordOption, TablePropertyDefinition } from "../../types";
import {
  useRelatedRecordOptionsQuery,
  useTablePropertyDefinitionsQuery,
  useTablePropertyValuesQuery,
} from "../../data/workflowQueries";
import { useTransactionPatchMutation } from "../../data/recordQueries";
import type { RecordPropertyDefinition } from "../../table-kit";
import { WireframeSchemaInspector } from "../workspace/WireframeSchemaInspector";

function RelationPicker({
  definition,
  record,
  value,
  onChange,
  onCommit,
  nullable,
}: {
  definition: TablePropertyDefinition;
  record: ExpenseTransaction;
  value: string;
  onChange: (value: string) => void;
  onCommit: (value: string) => Promise<void>;
  nullable: boolean;
}) {
  const [search, setSearch] = useState("");
  const options = useRelatedRecordOptionsQuery("Transactions", definition.id, search, record.id);
  const choose = async (option: RelatedRecordOption) => {
    onChange(option.id);
    await onCommit(option.id);
  };
  return (
    <div className="transaction-relation-picker" aria-label={`Choose ${definition.name}`}>
      <GSearchField
        label={`Search ${definition.name}`}
        value={search}
        onChange={setSearch}
        loading={options.isFetching}
      />
      {options.isError ? <p role="alert">Could not load related records.</p> : null}
      <div className="transaction-relation-options" role="listbox" aria-label={`${definition.name} results`}>
        {(options.data ?? []).map((option) => (
          <GemButton
            key={option.id}
            type="button"
            variant={option.id === value ? "outlined" : "quiet"}
            tone="secondary"
            role="option"
            aria-selected={option.id === value}
            onClick={() => void choose(option)}
          >
            {option.name}
          </GemButton>
        ))}
        {options.isSuccess && options.data?.length === 0 ? <p>No matching records.</p> : null}
      </div>
      {nullable ? (
        <GemButton type="button" variant="quiet" tone="secondary" onClick={() => void onCommit("")}>
          Clear relation
        </GemButton>
      ) : null}
    </div>
  );
}

export function TransactionsInspector({
  record,
  properties,
  schemaProperties,
}: {
  record: ExpenseTransaction;
  properties: readonly RecordPropertyDefinition<ExpenseTransaction>[];
  schemaProperties?: readonly RecordPropertyDefinition<ExpenseTransaction>[];
}) {
  const definitions = useTablePropertyDefinitionsQuery("Transactions");
  const values = useTablePropertyValuesQuery("Transactions", record.id);
  const patch = useTransactionPatchMutation();
  const configuredRelations = definitions.data?.filter((item) => item.kind === "Relation") ?? [];
  const enriched = properties.map((property) => {
    const definition = configuredRelations.find(
      (item) => item.sourceColumnName?.toLowerCase() === property.sourceField?.toLowerCase(),
    );
    if (!definition) return property;
    const resolved = values.data?.find((item) => item.definitionID === definition.id);
    const relationValue = resolved?.recordID ?? String(property.getValue(record).raw ?? "");
    const href =
      resolved?.recordID && definition.targetTableName
        ? `/schema-wireframe/${encodeURIComponent(definition.targetTableName)}/record/${encodeURIComponent(resolved.recordID)}`
        : undefined;
    const display = values.isSuccess
      ? resolved?.displayValue ?? (relationValue ? "Unavailable related record" : "—")
      : property.getValue(record).display;
    return {
      ...property,
      kind: "relation" as const,
      getValue: () => ({
        raw: relationValue,
        display,
        href,
      }),
      edit: {
        inputType: "text" as const,
        nullable: property.id === "subcategory",
        onSave: async (_item: unknown, next: string | number | null) => {
          const numeric = next === "" || next === null ? null : Number(next);
          await patch.mutateAsync({
            id: record.id,
            patch:
              property.id === "category"
                ? { categoryID: numeric as number, subcategoryID: null }
                : { subcategoryID: numeric },
          });
        },
        renderEditor: (editor: {
          value: string;
          onChange: (value: string) => void;
          onCommit: (value: string) => Promise<void>;
        }) => (
          <RelationPicker
            definition={definition}
            record={record}
            value={editor.value}
            onChange={editor.onChange}
            onCommit={editor.onCommit}
            nullable={property.id === "subcategory"}
          />
        ),
      },
    } satisfies RecordPropertyDefinition<ExpenseTransaction>;
  });
  const lookupProperties = (definitions.data ?? [])
    .filter((definition) => definition.kind === "Lookup")
    .map((definition) => {
      const value = values.data?.find((item) => item.definitionID === definition.id);
      return {
        id: definition.id,
        label: definition.name,
        kind: "text" as const,
        getValue: () => ({ raw: value?.value, display: value?.displayValue ?? "—" }),
      } satisfies RecordPropertyDefinition<ExpenseTransaction>;
    });

  if (definitions.isError || values.isError) {
    return (
      <>
        <p role="status">Related properties could not be loaded.</p>
        <WireframeSchemaInspector record={record} properties={properties} />
      </>
    );
  }
  return (
    <WireframeSchemaInspector
      record={record}
      properties={[...enriched, ...lookupProperties, ...(schemaProperties ?? [])]}
    />
  );
}
