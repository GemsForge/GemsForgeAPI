import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useSchemaPageRecordsQuery, useSchemaPageTablesQuery } from "../../data/workflowQueries";
import { createLiveSchemaProperties, type RecordPropertyDefinition } from "../../table-kit";
import type { SchemaPageRecords } from "../../types";
import { createSchemaRecordOptions } from "./SchemaRecordActions";
import { WireframeCollectionView, type WireframeRecord } from "../workspace/WireframeCollectionView";
import { WireframeSchemaInspector } from "../workspace/WireframeSchemaInspector";

type SchemaRecord = Record<string, string | null> & WireframeRecord;

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
  const { tableName = "" } = useParams();
  const isLegacyServiceLogoAssets = tableName === "ServiceLogoAssets";
  const pages = useSchemaPageTablesQuery();
  const result = useSchemaPageRecordsQuery(tableName);
  const table = result.data?.table ?? pages.data?.tables.find((candidate) => candidate.name === tableName);
  const records = useMemo(() => schemaRecords(result.data), [result.data]);
  const properties = useMemo<readonly RecordPropertyDefinition<SchemaRecord>[]>(
    () => (table ? createLiveSchemaProperties<SchemaRecord>(table).filter((property) => property.id !== "HubID") : []),
    [table],
  );

  if (result.isPending || pages.isPending) return <p role="status">Loading collection…</p>;
  if (result.isError) return <p role="alert">This collection could not be loaded.</p>;
  if (!table) return <p role="alert">This collection is not available in the live database.</p>;

  const titleProperty = properties.find((property) => !property.primary) ?? properties[0];
  const subtitleProperty = properties.find((property) => property !== titleProperty && !property.primary);
  const statusProperty = properties.find((property) => /status/i.test(property.id));
  const dateProperty = properties.find((property) => property.kind === "date");

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
                  <strong>Obsolete legacy table.</strong> Service logos now use <code>Services.LogoFileMetadataID</code>.
                  This table remains only to backfill existing logo references and can be removed after verification in
                  each database.
                </>
              ),
            }
          : {}),
        activeCollection: tableName,
        records,
        properties,
        ...(isLegacyServiceLogoAssets
          ? {}
          : {
              newRecordUtility: {
                options: createSchemaRecordOptions(table),
              },
            }),
        searchValues: (record) => Object.values(record).filter((value): value is string => typeof value === "string"),
        cardTitle: (record) => recordText(record, titleProperty?.id) || record.id,
        cardSubtitle: (record) => recordText(record, subtitleProperty?.id) || tableName,
        cardStatus: (record) => recordText(record, statusProperty?.id),
        cardMeta: (record) => recordText(record, dateProperty?.id) || record.id,
        inspector: (record, schemaProperties) => (
          <WireframeSchemaInspector record={record} properties={schemaProperties ?? properties} />
        ),
      }}
    />
  );
}
