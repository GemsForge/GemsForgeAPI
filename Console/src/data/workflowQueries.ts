import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { ForgeKeeperPatch, TableBuilderRequest, TablePropertyDefinitionInput } from "../types";
import { fileQueryKeys } from "./fileQueries";

export type PageScope = { kind: "domain"; id: string } | { kind: "children"; id: number } | { kind: "roots" };
export const workflowQueryKeys = {
  pages: ["pages"] as const,
  pageList: (scope: PageScope) => ["pages", scope] as const,
  schema: ["live-schema"] as const,
  schemaPageTables: ["schema-page-tables"] as const,
  schemaPageRecords: (tableName: string, offset?: number) =>
    offset === undefined
      ? (["schema-page-records", tableName] as const)
      : (["schema-page-records", tableName, offset] as const),
  schemaPageRecord: (tableName: string, recordID: string | null) =>
    ["schema-page-record", tableName, recordID] as const,
  tablePropertyDefinitions: (tableName: string) => ["table-property-definitions", tableName] as const,
  tablePropertyOptions: (tableName: string, propertyID: string, recordID: string | null, search: string) =>
    ["table-property-options", tableName, propertyID, recordID, search] as const,
  tablePropertyValues: (tableName: string, recordID: string | null) =>
    ["table-property-values", tableName, recordID] as const,
  tablePropertyValuesForTable: (tableName: string) => ["table-property-values", tableName] as const,
  guidance: ["schema-guidance"] as const,
  capabilities: ["database-capabilities"] as const,
  localDatabases: ["local-databases"] as const,
  importableTables: ["table-import", "tables"] as const,
  tableRecords: (table: string) => ["table-records", table] as const,
};

export function usePagesQuery(scope: PageScope, enabled = true) {
  return useQuery({
    queryKey: workflowQueryKeys.pageList(scope),
    enabled,
    queryFn: ({ signal }) =>
      scope.kind === "domain"
        ? api.listPagesForDomain(scope.id, signal)
        : scope.kind === "children"
          ? api.listChildren(scope.id, signal)
          : api.listRootPages(signal),
  });
}
export function usePageMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: ForgeKeeperPatch }) => api.patchPage(id, patch),
    onSuccess: () => client.invalidateQueries({ queryKey: workflowQueryKeys.pages }),
  });
}
export function useLiveSchemaQuery() {
  return useQuery({ queryKey: workflowQueryKeys.schema, queryFn: ({ signal }) => api.getLiveSchema(signal) });
}
export function useSchemaPageTablesQuery() {
  return useQuery({
    queryKey: workflowQueryKeys.schemaPageTables,
    queryFn: ({ signal }) => api.getSchemaPageTables(signal),
  });
}
export function useCreateSchemaPageMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.createSchemaPage,
    onSuccess: (table) => {
      void client.invalidateQueries({ queryKey: workflowQueryKeys.schemaPageTables });
      void client.invalidateQueries({ queryKey: workflowQueryKeys.schemaPageRecords(table.name) });
    },
  });
}
export function useSchemaPageRecordsQuery(tableName: string, offset = 0) {
  return useQuery({
    queryKey: workflowQueryKeys.schemaPageRecords(tableName, offset),
    queryFn: ({ signal }) => api.getSchemaPageRecords(tableName, offset, signal),
    enabled: Boolean(tableName),
  });
}
export function useSchemaPageRecordQuery(tableName: string, recordID: string | null) {
  return useQuery({
    queryKey: workflowQueryKeys.schemaPageRecord(tableName, recordID),
    queryFn: ({ signal }) => api.getSchemaPageRecord(tableName, recordID!, signal),
    enabled: Boolean(tableName && recordID),
  });
}
export function useTablePropertyDefinitionsQuery(tableName: string, enabled = true) {
  return useQuery({
    queryKey: workflowQueryKeys.tablePropertyDefinitions(tableName),
    queryFn: ({ signal }) => api.getTablePropertyDefinitions(tableName, signal),
    enabled: Boolean(tableName) && enabled,
  });
}
export function useSaveTablePropertyDefinitionsMutation(tableName: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (definitions: TablePropertyDefinitionInput[]) =>
      api.saveTablePropertyDefinitions(tableName, definitions),
    onSuccess: async (definitions) => {
      client.setQueryData(workflowQueryKeys.tablePropertyDefinitions(tableName), definitions);
      await client.invalidateQueries({ queryKey: workflowQueryKeys.schemaPageRecords(tableName) });
      await client.invalidateQueries({ queryKey: workflowQueryKeys.tablePropertyValuesForTable(tableName) });
    },
  });
}
export function useRelatedRecordOptionsQuery(
  tableName: string,
  propertyID: string | null,
  search: string,
  recordID: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: workflowQueryKeys.tablePropertyOptions(tableName, propertyID ?? "", recordID, search),
    queryFn: ({ signal }) => api.getRelatedRecordOptions(tableName, propertyID!, search, recordID ?? undefined, signal),
    enabled: Boolean(tableName && propertyID) && enabled,
  });
}
export function useTablePropertyValuesQuery(tableName: string, recordID: string | null, enabled = true) {
  return useQuery({
    queryKey: workflowQueryKeys.tablePropertyValues(tableName, recordID),
    queryFn: ({ signal }) => api.getTablePropertyValues(tableName, recordID!, signal),
    enabled: Boolean(tableName && recordID) && enabled,
  });
}
export function useCreateSchemaPageRecordMutation(tableName: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (values: Record<string, string | number | boolean | null>) =>
      api.createSchemaPageRecord(tableName, values),
    onSuccess: () => client.invalidateQueries({ queryKey: workflowQueryKeys.schemaPageRecords(tableName) }),
  });
}
export function usePatchSchemaPageRecordMutation(tableName: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      recordID,
      values,
    }: {
      recordID: string;
      values: Record<string, string | number | boolean | null>;
    }) => api.patchSchemaPageRecord(tableName, recordID, values),
    onSuccess: async (_result, { recordID }) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: workflowQueryKeys.schemaPageRecords(tableName) }),
        client.invalidateQueries({ queryKey: workflowQueryKeys.schemaPageRecord(tableName, recordID) }),
      ]);
    },
  });
}
export function usePatchSchemaPageAttachmentMutation(tableName: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      recordID,
      columnName,
      fileMetadataID,
    }: {
      recordID: string;
      columnName: string;
      fileMetadataID: string | null;
    }) => api.patchSchemaPageAttachment(tableName, recordID, columnName, fileMetadataID),
    onSuccess: async (_result, { recordID }) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: workflowQueryKeys.schemaPageRecords(tableName) }),
        client.invalidateQueries({ queryKey: workflowQueryKeys.schemaPageRecord(tableName, recordID) }),
      ]);
    },
  });
}
export function useImportableSQLTablesQuery() {
  return useQuery({
    queryKey: workflowQueryKeys.importableTables,
    queryFn: ({ signal }) => api.getImportableSQLTables(signal),
  });
}
export function usePreviewTableCSVImportMutation() {
  return useMutation({ mutationFn: api.previewTableCSVImport });
}
export function useCommitTableCSVImportMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.commitTableCSVImport,
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: workflowQueryKeys.importableTables });
      void client.invalidateQueries({ queryKey: workflowQueryKeys.schema });
      void client.invalidateQueries({ queryKey: workflowQueryKeys.tableRecords(result.table) });
      void client.invalidateQueries({ queryKey: workflowQueryKeys.schemaPageRecords(result.table) });
    },
  });
}
export function usePreviewRepositoryMigrationsMutation() {
  return useMutation({ mutationFn: api.previewRepositoryMigrations });
}
export function useExecuteRepositoryMigrationsMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.executeRepositoryMigrations,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: workflowQueryKeys.schema });
      void client.invalidateQueries({ queryKey: workflowQueryKeys.schemaPageTables });
    },
  });
}
export function useSchemaGuidanceQuery() {
  return useQuery({
    queryKey: workflowQueryKeys.guidance,
    queryFn: ({ signal }) => api.getSchemaBuilderGuidance(signal),
  });
}
export function useDatabaseCapabilitiesQuery() {
  return useQuery({
    queryKey: workflowQueryKeys.capabilities,
    queryFn: ({ signal }) => api.getLocalDatabaseCapabilities(signal),
  });
}
export function useLocalDatabasesQuery() {
  return useQuery({
    queryKey: workflowQueryKeys.localDatabases,
    queryFn: ({ signal }) => api.getLocalDatabases(signal),
  });
}
export function useCreateDatabaseMutation() {
  return useMutation({ mutationFn: api.createLocalDatabase });
}
export function usePreviewTableMutation() {
  return useMutation({ mutationFn: (definition: TableBuilderRequest) => api.previewUserTable(definition) });
}
export function useCreateTableMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.createUserTable,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: workflowQueryKeys.schema });
      void client.invalidateQueries({ queryKey: workflowQueryKeys.schemaPageTables });
    },
  });
}
export function usePreviewCSVMutation() {
  return useMutation({ mutationFn: api.previewHomeInventoryCSV });
}
export function useImportCSVMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.importHomeInventoryCSV,
    onSuccess: () => client.invalidateQueries({ queryKey: workflowQueryKeys.schema }),
  });
}
export function useUploadImageMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      kind,
      ownerType,
      ownerID,
    }: {
      file: File;
      kind: string;
      ownerType: string;
      ownerID: string;
    }) => api.uploadImage(file, kind, ownerType, ownerID),
    onSuccess: (metadata) => {
      client.setQueryData(fileQueryKeys.metadata(metadata.id), metadata);
    },
  });
}
