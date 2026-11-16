import { useMemo, useRef, useState } from "react";
import { decodeMultiSelectValue, GemButton, GStructuralField } from "@gemsforge/ui";
import type { TamaguiElement } from "tamagui";
import { useLocation, useOutletContext, useParams } from "react-router-dom";
import {
  useSchemaPageRecordQuery,
  useSchemaPageRecordsQuery,
  useSchemaPageTablesQuery,
  usePatchSchemaPageRecordMutation,
  usePatchSchemaPageAttachmentMutation,
  useTableColumnDefinitionsQuery,
  useTablePropertyDefinitionsQuery,
  useTablePropertyValuesBatchQuery,
  useRelatedRecordOptionsQuery,
  useSaveTableColumnDefinitionMutation,
} from "../../data/workflowQueries";
import { createLiveSchemaProperties, type RecordPropertyDefinition } from "../../table-kit";
import type { SchemaPageRecords } from "../../types";
import { createSchemaRecordOptions } from "./SchemaRecordActions";
import { WireframeCollectionView, type WireframeRecord } from "../workspace/WireframeCollectionView";
import { WireframeSchemaInspector } from "../workspace/WireframeSchemaInspector";
import { TableDropDialog } from "./TableDropDialog";

type SchemaRecord = Record<string, string | null> & WireframeRecord;

function RelationEditor({
  tableName,
  definitionID,
  label,
  value,
  onCommit,
}: {
  tableName: string;
  definitionID: string;
  label: string;
  value: string;
  onCommit: (value: string) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const options = useRelatedRecordOptionsQuery(tableName, definitionID, search, null);
  return (
    <GStructuralField
      kind="relation"
      label={label}
      search={search}
      onSearchChange={setSearch}
      options={(options.data ?? []).map((option) => ({ value: option.id, label: option.name }))}
      selectedValue={value}
      loading={options.isFetching}
      error={options.isError ? "Could not load related records." : undefined}
      nullable
      onSelect={(option) => void onCommit(option.value)}
      onClear={() => void onCommit("")}
    />
  );
}

function recordText(record: SchemaRecord, propertyID?: string) {
  return propertyID ? record[propertyID]?.trim() || "" : "";
}

function schemaRecords(data: SchemaPageRecords | undefined): SchemaRecord[] {
  const primaryKey = data?.table.columns.find((column) => column.primaryKey)?.name;
  return (data?.rows ?? []).map((row) => ({
    ...row,
    id: String((primaryKey ? row[primaryKey] : undefined) ?? ""),
  }));
}

export function WireframeSchemaPage() {
  const { onSuccess } = useOutletContext<{ onSuccess: (message: string) => void }>();
  const { tableName = "" } = useParams();
  const [deletePreviewOpen, setDeletePreviewOpen] = useState(false);
  const deleteTableButtonRef = useRef<TamaguiElement>(null);
  const location = useLocation();
  const recordID = location.pathname.match(/\/record\/([^/]+)$/)?.[1];
  const isLegacyServiceLogoAssets = tableName === "ServiceLogoAssets";
  const pages = useSchemaPageTablesQuery();
  const result = useSchemaPageRecordsQuery(tableName);
  const selectedRecord = useSchemaPageRecordQuery(tableName, recordID ? decodeURIComponent(recordID) : null);
  const patchRecord = usePatchSchemaPageRecordMutation(tableName);
  const definitions = useTableColumnDefinitionsQuery(tableName);
  const propertyDefinitions = useTablePropertyDefinitionsQuery(tableName);
  const saveDefinition = useSaveTableColumnDefinitionMutation(tableName);
  const patchAttachment = usePatchSchemaPageAttachmentMutation(tableName);
  const patchSchemaRecord = patchRecord.mutateAsync;
  const table = result.data?.table ?? pages.data?.tables.find((candidate) => candidate.name === tableName);
  const canOfferDeletion = Boolean(
    table?.columns.some((column) => column.name === "HubID" && !column.nullable) &&
    table.columns.filter((column) => column.primaryKey).length === 1,
  );
  const records = useMemo(() => {
    const loaded = schemaRecords(result.data);
    const row = selectedRecord.data?.row;
    if (!row) return loaded;
    const primaryKey = selectedRecord.data?.table.columns.find((column) => column.primaryKey)?.name;
    const id = String((primaryKey ? row[primaryKey] : undefined) ?? "");
    return [...loaded.filter((record) => record.id !== id), { ...row, id }];
  }, [result.data, selectedRecord.data]);
  const pageRecordIDs = useMemo(() => records.map((record) => record.id).filter(Boolean), [records]);
  const pagePropertyValues = useTablePropertyValuesBatchQuery(tableName, pageRecordIDs);
  const properties = useMemo<readonly RecordPropertyDefinition<SchemaRecord>[]>(() => {
    const base = table
      ? createLiveSchemaProperties<SchemaRecord>(table, async (record, propertyID, value) => {
          const definition = (definitions.data ?? []).find((item) => item.columnName === propertyID);
          await patchSchemaRecord({
            recordID: record.id,
            values: {
              [propertyID]:
                definition?.propertyType === "MultiSelect" && typeof value === "string"
                  ? value
                      .split(";")
                      .map((tag: string) => tag.trim())
                      .filter(Boolean)
                  : value,
            },
          });
        }).filter((property) => property.id !== "HubID")
      : [];
    const columnProperties = base.map((property) => {
      const definition = (definitions.data ?? []).find((item) => item.columnName === property.id);
      const relation = (propertyDefinitions.data ?? []).find(
        (item) => item.kind === "Relation" && item.sourceColumnName === property.id,
      );
      if (relation) {
        return {
          ...property,
          label: relation.name,
          kind: "relation" as const,
          propertyType: "Relation",
          iconName: "Relation",
          getValue: (current: SchemaRecord) => {
            const currentRawID = current[property.id] ?? "";
            const currentResolved = pagePropertyValues.data?.[current.id]?.find(
              (item) => item.definitionID === relation.id,
            );
            return {
              raw: currentRawID,
              display: currentResolved?.displayValue ?? (currentRawID ? "Unavailable related record" : "—"),
              href:
                currentRawID && relation.targetTableName
                  ? `/schema/${encodeURIComponent(relation.targetTableName)}/record/${encodeURIComponent(currentRawID)}`
                  : undefined,
            };
          },
          edit: {
            inputType: "text" as const,
            nullable: true,
            onSave: async (record: unknown, value: string | number | null) =>
              patchSchemaRecord({
                recordID: (record as SchemaRecord).id,
                values: { [property.id]: value === "" ? null : String(value) },
              }),
            renderEditor: (editor: {
              value: string;
              onChange: (value: string) => void;
              onCommit: (value: string) => Promise<void>;
            }) => (
              <RelationEditor
                tableName={tableName}
                definitionID={relation.id}
                label={relation.name}
                value={editor.value}
                onCommit={editor.onCommit}
              />
            ),
          },
        };
      }
      return definition
        ? {
            ...property,
            propertyType: definition.propertyType,
            selectOptions: definition.options,
            edit: property.edit
              ? {
                  ...property.edit,
                  options: definition.options.map((option) => ({
                    value: option.value,
                    label: option.value,
                    colorToken: option.color ?? undefined,
                  })),
                }
              : undefined,
            kind:
              definition.propertyType === "MultiSelect"
                ? ("multiSelect" as const)
                : definition.propertyType === "Status"
                  ? ("status" as const)
                  : ("select" as const),
          }
        : property;
    });
    return [
      ...columnProperties,
      ...(propertyDefinitions.data ?? [])
        .filter((definition) => definition.kind === "Lookup")
        .map(
          (definition) =>
            ({
              id: definition.id,
              label: definition.name,
              kind: "lookup" as const,
              propertyType: "Lookup",
              iconName: "Lookup",
              getValue: (current: SchemaRecord) => {
                const value = pagePropertyValues.data?.[current.id]?.find(
                  (item) => item.definitionID === definition.id,
                );
                return { raw: value?.value, display: value?.displayValue ?? "—" };
              },
            }) satisfies RecordPropertyDefinition<SchemaRecord>,
        ),
    ];
  }, [definitions.data, pagePropertyValues.data, patchSchemaRecord, propertyDefinitions.data, table, tableName]);
  const resolvedProperties = properties.length > 0 ? properties : [];

  if (result.isPending || pages.isPending || (recordID && selectedRecord.isPending))
    return <p role="status">Loading collection…</p>;
  if (recordID && selectedRecord.isError) return <p role="alert">This record is unavailable in this collection.</p>;
  if (result.isError) return <p role="alert">This collection could not be loaded.</p>;
  if (!table) return <p role="alert">This collection is not available in the live database.</p>;

  const titleProperty = resolvedProperties.find((property) => !property.primary) ?? resolvedProperties[0];
  const subtitleProperty = resolvedProperties.find((property) => property !== titleProperty && !property.primary);
  const statusProperty = resolvedProperties.find((property) => /status/i.test(property.id));
  const dateProperty = resolvedProperties.find((property) => property.kind === "date");

  return (
    <WireframeCollectionView
      config={{
        tableName,
        title: tableName,
        description: "Records from this collection in your live database.",
        ...(isLegacyServiceLogoAssets
          ? {
              headerBanner: (
                <>
                  <strong>Obsolete legacy table.</strong> Service logos now use <code>Services.LogoFileMetadataID</code>
                  . This table remains only to backfill existing logo references and can be removed after verification
                  in each database.
                </>
              ),
            }
          : {}),
        activeCollection: tableName,
        tableActions: canOfferDeletion ? (
          <>
            <GemButton
              ref={deleteTableButtonRef}
              type="button"
              variant="quiet"
              tone="secondary"
              className="is-danger"
              aria-haspopup="dialog"
              aria-expanded={deletePreviewOpen}
              onClick={() => setDeletePreviewOpen(true)}
            >
              Delete table…
            </GemButton>
            {deletePreviewOpen ? (
              <TableDropDialog
                tableName={tableName}
                onClose={() => {
                  setDeletePreviewOpen(false);
                  requestAnimationFrame(() => deleteTableButtonRef.current?.focus());
                }}
                onSuccess={onSuccess}
              />
            ) : null}
          </>
        ) : undefined,
        records,
        properties: resolvedProperties,
        columnDefinitions: definitions.data ?? [],
        onSaveColumnDefinition: async (propertyID, type, options, colorToken) => {
          if (!["Select", "MultiSelect", "Status"].includes(type)) {
            const { api } = await import("../../api");
            await api.deleteTableColumnDefinition(tableName, propertyID);
            return;
          }
          await saveDefinition.mutateAsync({
            columnName: propertyID,
            input: {
              propertyType: type as "Select" | "MultiSelect" | "Status",
              options: options.map((value) => ({ value, color: colorToken as import("../../types").TableColumnColor })),
            },
          });
        },
        ...(isLegacyServiceLogoAssets
          ? {}
          : {
              newRecordUtility: {
                options: createSchemaRecordOptions(table),
              },
            }),
        searchValues: (record) =>
          Object.entries(record).flatMap(([columnName, value]) => {
            if (typeof value !== "string") return [];
            return definitions.data?.find((definition) => definition.columnName === columnName)?.propertyType ===
              "MultiSelect"
              ? decodeMultiSelectValue(value)
              : [value];
          }),
        cardTitle: (record) => recordText(record, titleProperty?.id) || record.id,
        cardSubtitle: (record) => recordText(record, subtitleProperty?.id) || tableName,
        cardStatus: (record) => recordText(record, statusProperty?.id),
        cardMeta: (record) => recordText(record, dateProperty?.id) || record.id,
        inspector: (record, _schemaProperties) => (
          <WireframeSchemaInspector
            record={record}
            // `properties` carries the schema-aware PATCH handlers. The generated
            // workspace metadata is display-only and would make every field read-only.
            properties={properties}
            attachmentOwnerType={tableName}
            onAttachmentChange={(record, columnName, fileMetadataID) =>
              patchAttachment.mutateAsync({ recordID: record.id, columnName, fileMetadataID })
            }
          />
        ),
      }}
    />
  );
}
