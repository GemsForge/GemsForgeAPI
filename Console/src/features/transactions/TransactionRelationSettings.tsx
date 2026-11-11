import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GemButton, GemTextField, GSelectField } from "@gemsforge/ui";
import type { TablePropertyDefinition, TablePropertyDefinitionInput } from "../../types";
import {
  useSaveTablePropertyDefinitionsMutation,
  useSchemaPageTablesQuery,
  useTablePropertyDefinitionsQuery,
} from "../../data/workflowQueries";

const TABLE_NAME = "Transactions";
const RELATIONS = [
  {
    id: "transaction-category",
    sourceColumnName: "CategoryID",
    name: "Category",
    suggestedTable: "BudgetCategories",
    display: "Category",
  },
  {
    id: "transaction-subcategory",
    sourceColumnName: "SubcategoryID",
    name: "Subcategory",
    suggestedTable: "BudgetSubcategories",
    display: "Subcategory",
  },
] as const;

function columnsFor(tableName: string, tables: ReturnType<typeof useSchemaPageTablesQuery>["data"]) {
  return tables?.tables.find((table) => table.name === tableName)?.columns ?? [];
}

function targetFields(tableName: string, tables: ReturnType<typeof useSchemaPageTablesQuery>["data"]) {
  return columnsFor(tableName, tables).filter(
    (column) => column.name !== "HubID" && !column.dataType.toUpperCase().includes("BLOB"),
  );
}

export function TransactionRelationSettings() {
  const tables = useSchemaPageTablesQuery();
  const definitions = useTablePropertyDefinitionsQuery(TABLE_NAME);
  const { mutateAsync: saveDefinitions, isPending: savePending } = useSaveTablePropertyDefinitionsMutation(TABLE_NAME);
  const [draft, setDraft] = useState<TablePropertyDefinition[]>([]);
  const [lookupName, setLookupName] = useState("");
  const [lookupRelationID, setLookupRelationID] = useState<string>(RELATIONS[0].id);
  const [lookupColumn, setLookupColumn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const defaultSetupStarted = useRef(false);

  useEffect(() => setDraft(definitions.data ?? []), [definitions.data]);

  const relationDrafts = useMemo(
    () =>
      RELATIONS.map((relation) => {
        const saved = draft.find((item) => item.id === relation.id && item.kind === "Relation");
        const targetTableName = relation.suggestedTable;
        const columns = columnsFor(targetTableName, tables.data);
        const key = columns.find((column) => column.primaryKey)?.name ?? "";
        const display =
          saved?.targetDisplayColumnName ??
          columns.find((column) => column.name === relation.display)?.name ??
          targetFields(targetTableName, tables.data).find((column) => !column.primaryKey)?.name ??
          "";
        return {
          ...relation,
          saved,
          targetTableName,
          targetKeyColumnName: key,
          targetDisplayColumnName: display,
        };
      }),
    [draft, tables.data],
  );
  const activeLookupRelation = relationDrafts.find((relation) => relation.id === lookupRelationID) ?? relationDrafts[0];
  const lookupColumns = targetFields(activeLookupRelation?.targetTableName ?? "", tables.data);

  const persist = useCallback(
    async (next: TablePropertyDefinitionInput[]) => {
      setError(null);
      try {
        const saved = await saveDefinitions(next);
        setDraft(saved);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not save relation settings.");
      }
    },
    [saveDefinitions],
  );

  useEffect(() => {
    if (
      definitions.isPending ||
      tables.isPending ||
      definitions.isError ||
      tables.isError ||
      definitions.data === undefined ||
      tables.data === undefined ||
      defaultSetupStarted.current
    ) {
      return;
    }

    const defaults = RELATIONS.flatMap((relation) => {
      const columns = columnsFor(relation.suggestedTable, tables.data);
      const key = columns.find((column) => column.primaryKey)?.name;
      const display = columns.find((column) => column.name === relation.display)?.name;
      if (!key || !display) return [];
      return [
        {
          id: relation.id,
          name: relation.name,
          kind: "Relation" as const,
          sourceColumnName: relation.sourceColumnName,
          targetTableName: relation.suggestedTable,
          targetKeyColumnName: key,
          targetDisplayColumnName: display,
          relationDefinitionID: null,
          targetColumnName: null,
          filterByDefinitionID: relation.id === "transaction-subcategory" ? "transaction-category" : null,
          targetFilterColumnName: relation.id === "transaction-subcategory" ? "CategoryID" : null,
        },
      ];
    });
    const existingIDs = new Set(definitions.data.filter((item) => item.kind === "Relation").map((item) => item.id));
    const missingDefaults = defaults.filter((item) => !existingIDs.has(item.id));
    if (missingDefaults.length === 0) return;

    defaultSetupStarted.current = true;
    const preservedDefinitions = definitions.data.filter(
      (item) => !RELATIONS.some((relation) => relation.id === item.id),
    );
    const existingDefaults = definitions.data.filter((item) => RELATIONS.some((relation) => relation.id === item.id));
    void persist([...preservedDefinitions, ...existingDefaults, ...missingDefaults]);
  }, [
    definitions.data,
    definitions.isError,
    definitions.isPending,
    persist,
    tables.data,
    tables.isError,
    tables.isPending,
  ]);

  const saveRelations = () => {
    const relations: TablePropertyDefinitionInput[] = relationDrafts.map((relation) => {
      const target = columnsFor(relation.targetTableName, tables.data);
      const targetKeyColumnName = target.find((column) => column.primaryKey)?.name ?? relation.targetKeyColumnName;
      return {
        id: relation.id,
        name: relation.name,
        kind: "Relation",
        sourceColumnName: relation.sourceColumnName,
        targetTableName: relation.targetTableName,
        targetKeyColumnName,
        targetDisplayColumnName: relation.targetDisplayColumnName,
        relationDefinitionID: null,
        targetColumnName: null,
        filterByDefinitionID: relation.id === "transaction-subcategory" ? "transaction-category" : null,
        targetFilterColumnName: relation.id === "transaction-subcategory" ? "CategoryID" : null,
      };
    });
    const lookups = draft.filter((definition) => definition.kind === "Lookup");
    void persist([...relations, ...lookups]);
  };

  const addLookup = () => {
    if (!lookupName.trim() || !lookupColumn || !activeLookupRelation) return;
    const id = `transaction-lookup-${crypto.randomUUID()}`;
    const next = [
      ...draft.filter((definition) => definition.kind === "Relation"),
      ...draft.filter((definition) => definition.kind === "Lookup"),
      {
        id,
        name: lookupName.trim(),
        kind: "Lookup" as const,
        sourceColumnName: null,
        targetTableName: null,
        targetKeyColumnName: null,
        targetDisplayColumnName: null,
        relationDefinitionID: lookupRelationID,
        targetColumnName: lookupColumn,
        filterByDefinitionID: null,
        targetFilterColumnName: null,
      },
    ];
    setDraft(next as TablePropertyDefinition[]);
    setLookupName("");
  };

  const removeLookup = (id: string) => setDraft((current) => current.filter((definition) => definition.id !== id));

  if (definitions.isPending || tables.isPending) return <p role="status">Loading relation settings…</p>;
  if (definitions.isError || tables.isError) return <p role="alert">Relation settings could not be loaded.</p>;

  return (
    <section className="transaction-relation-settings" aria-label="Relations and lookups">
      <h3>Relations</h3>
      {relationDrafts.map((relation) => (
        <div className="transaction-relation-settings-row" key={relation.id}>
          <strong>
            {relation.name} · {relation.sourceColumnName}
          </strong>
          <p>Related table: {relation.targetTableName}</p>
          <GSelectField
            id={`${relation.id}-display`}
            label="Record name property"
            value={relation.targetDisplayColumnName}
            options={targetFields(relation.targetTableName, tables.data).map((column) => ({
              value: column.name,
              label: column.name,
            }))}
            onChange={(targetDisplayColumnName) =>
              setDraft((current) => {
                const existing = current.find((item) => item.id === relation.id);
                const next: TablePropertyDefinition = {
                  ...(existing ?? {
                    id: relation.id,
                    tableName: TABLE_NAME,
                    name: relation.name,
                    kind: "Relation" as const,
                    sourceColumnName: relation.sourceColumnName,
                    targetTableName: relation.targetTableName,
                    targetKeyColumnName: relation.targetKeyColumnName,
                    relationDefinitionID: null,
                    targetColumnName: null,
                    filterByDefinitionID: relation.id === "transaction-subcategory" ? "transaction-category" : null,
                    targetFilterColumnName: relation.id === "transaction-subcategory" ? "CategoryID" : null,
                    sortOrder: 0,
                  }),
                  targetDisplayColumnName,
                };
                return [...current.filter((item) => item.id !== relation.id), next];
              })
            }
            wireframe
          />
        </div>
      ))}
      <h3>Lookups</h3>
      <p>Choose a relation and a property. Its value stays linked to the related record.</p>
      <div className="transaction-lookup-create">
        <GemTextField
          id="transaction-lookup-name"
          label="Lookup property name"
          value={lookupName}
          onChange={(event) => setLookupName(event.currentTarget.value)}
        />
        <GSelectField
          id="transaction-lookup-relation"
          label="Relation"
          value={lookupRelationID}
          options={relationDrafts.map((relation) => ({ value: relation.id, label: relation.name }))}
          onChange={(value) => {
            setLookupRelationID(value);
            setLookupColumn("");
          }}
          wireframe
        />
        <GSelectField
          id="transaction-lookup-column"
          label="Related property"
          value={lookupColumn}
          options={lookupColumns.map((column) => ({ value: column.name, label: column.name }))}
          onChange={setLookupColumn}
          wireframe
        />
        <GemButton
          type="button"
          variant="outlined"
          tone="secondary"
          onClick={addLookup}
          disabled={!lookupName.trim() || !lookupColumn}
        >
          Add lookup
        </GemButton>
      </div>
      {draft
        .filter((definition) => definition.kind === "Lookup")
        .map((lookup) => (
          <div className="transaction-lookup-row" key={lookup.id}>
            <span>
              {lookup.name}: {relationDrafts.find((relation) => relation.id === lookup.relationDefinitionID)?.name}.
              {lookup.targetColumnName}
            </span>
            <GemButton
              type="button"
              variant="quiet"
              tone="secondary"
              onClick={() => removeLookup(lookup.id)}
              aria-label={`Remove ${lookup.name} lookup`}
            >
              Remove
            </GemButton>
          </div>
        ))}
      {error ? <p role="alert">{error}</p> : null}
      <GemButton type="button" onClick={saveRelations} disabled={savePending}>
        {savePending ? "Saving relations…" : "Save relations and lookups"}
      </GemButton>
    </section>
  );
}
