import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GStructuralField } from "@gemsforge/ui";
import type { ExpenseTransaction, TablePropertyDefinition } from "../../types";
import {
  useRelatedRecordOptionsQuery,
  useTablePropertyDefinitionsQuery,
  useTablePropertyValuesQuery,
} from "../../data/workflowQueries";
import { useTransactionPatchMutation } from "../../data/recordQueries";
import type { RecordPropertyDefinition } from "../../table-kit";
import { TransactionRelationSettings } from "./TransactionRelationSettings";
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
  return (
    <GStructuralField
      kind="relation"
      label={definition.name}
      search={search}
      onSearchChange={setSearch}
      options={(options.data ?? []).map((option) => ({ value: option.id, label: option.name }))}
      selectedValue={value}
      loading={options.isFetching}
      error={options.isError ? "Could not load related records." : undefined}
      nullable={nullable}
      onSelect={(option) => {
        onChange(option.value);
        void onCommit(option.value);
      }}
      onClear={() => void onCommit("")}
    />
  );
}

function LookupSourceSearch({
  definition,
  record,
  onSelect,
}: {
  definition: TablePropertyDefinition;
  record: ExpenseTransaction;
  onSelect: (recordID: string) => void;
}) {
  const [search, setSearch] = useState("");
  const options = useRelatedRecordOptionsQuery("Transactions", definition.id, search, record.id);
  return (
    <GStructuralField
      kind="lookup"
      label={definition.name}
      search={search}
      onSearchChange={setSearch}
      options={(options.data ?? []).map((option) => ({ value: option.id, label: option.name }))}
      loading={options.isFetching}
      error={options.isError ? "Could not load lookup source records." : undefined}
      emptyMessage="No related records match this search."
      onSelect={(option) => onSelect(option.value)}
    />
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
  const navigate = useNavigate();
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
      ? (resolved?.displayValue ?? (relationValue ? "Unavailable related record" : "—"))
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
      const relation = configuredRelations.find((item) => item.id === definition.relationDefinitionID);
      return {
        id: definition.id,
        label: definition.name,
        kind: "text" as const,
        getValue: () => ({ raw: value?.value, display: value?.displayValue ?? "—" }),
        ...(relation
          ? {
              kind: "lookup" as const,
              edit: {
                inputType: "text" as const,
                onSave: async (_item: unknown, relatedRecordID: string | number | null) => {
                  if (relatedRecordID === null || relatedRecordID === "" || !relation.targetTableName) return;
                  navigate(
                    `/schema-wireframe/${encodeURIComponent(relation.targetTableName)}/record/${encodeURIComponent(String(relatedRecordID))}`,
                  );
                },
                renderEditor: (editor: {
                  value: string;
                  onChange: (value: string) => void;
                  onCommit: (value: string) => Promise<void>;
                }) => (
                  <LookupSourceSearch
                    definition={relation}
                    record={record}
                    onSelect={(recordID) => void editor.onCommit(recordID)}
                  />
                ),
              },
            }
          : {}),
      } satisfies RecordPropertyDefinition<ExpenseTransaction>;
    });

  const settings = (
    <details className="transaction-relations-disclosure">
      <summary>Relations and lookups</summary>
      <TransactionRelationSettings />
    </details>
  );

  if (definitions.isError || values.isError) {
    return (
      <>
        {settings}
        <p role="status">Related properties could not be loaded.</p>
        <WireframeSchemaInspector record={record} properties={properties} />
      </>
    );
  }
  return (
    <>
      {settings}
      <WireframeSchemaInspector
        record={record}
        properties={[...enriched, ...lookupProperties, ...(schemaProperties ?? [])]}
      />
    </>
  );
}
