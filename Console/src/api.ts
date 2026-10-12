import type { Address, Domain, Education, Employment, ExpenseTransaction, FileMetadata, ForgeKeeperPage, ForgeKeeperPatch, GemHue, HomeInventoryCSVImportResult, HomeInventoryCSVPreview, LiveSchema, LocalDatabaseCapabilities, LocalDatabaseCreationResult, SchemaBuilderGuidance, TableBuilderRequest, UserTableCreationResult, UserTablePreview } from "./types";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new Error(problem.reason || `${response.status} ${response.statusText}`);
  }

  return response.status === 204 ? (null as T) : (await response.json() as T);
}

export const api = {
  listDomains: () => request<Domain[]>("/domains"),
  listPagesForDomain: (domainID: string) =>
    request<ForgeKeeperPage[]>(`/domains/${encodeURIComponent(domainID)}/forgekeeper`),
  listRootPages: () => request<ForgeKeeperPage[]>("/forgekeeper/roots"),
  listChildren: (pageID: number) => request<ForgeKeeperPage[]>(`/forgekeeper/${pageID}/children`),
  patchPage: (pageID: number, patch: ForgeKeeperPatch) =>
    request<ForgeKeeperPage>(`/forgekeeper/${pageID}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  listGemHues: () => request<GemHue[]>("/gemhues"),
  getGemHue: (hueID: string) => request<GemHue>(`/gemhues/${encodeURIComponent(hueID)}`),
  getGemHueImage: (hueID: string) => fetch(`/gemhues/${encodeURIComponent(hueID)}/image`),
  listEducation: () => request<Education[]>("/education"),
  getEducation: (educationID: string) =>
    request<Education>(`/education/${encodeURIComponent(educationID)}`),
  listEmployment: () => request<Employment[]>("/employment"),
  getEmployment: (employmentID: string) =>
    request<Employment>(`/employment/${encodeURIComponent(employmentID)}`),
  listAddresses: () => request<Address[]>("/addresses"),
  getAddress: (addressID: string) =>
    request<Address>(`/addresses/${encodeURIComponent(addressID)}`),
  listTransactions: () => request<ExpenseTransaction[]>("/transactions"),
  getTransaction: (transactionID: string) =>
    request<ExpenseTransaction>(`/transactions/${encodeURIComponent(transactionID)}`),
  uploadImage: async (file: File, fileKind: string, ownerType: string, ownerID: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("fileKind", fileKind);
    form.append("ownerType", ownerType);
    form.append("ownerID", ownerID);
    const response = await fetch("/file-uploads", { method: "POST", body: form });
    if (!response.ok) {
      const problem = await response.json().catch(() => ({}));
      throw new Error(problem.reason || `${response.status} ${response.statusText}`);
    }
    return await response.json() as FileMetadata;
  },
  patchAddressAttachment: (addressID: string, fileMetadataID: string | null) =>
    request<Address>(`/addresses/${encodeURIComponent(addressID)}/attachment`, {
      method: "PATCH", body: JSON.stringify({ fileMetadataID }),
    }),
  patchTransactionImage: (transactionID: string, fileMetadataID: string | null) =>
    request<ExpenseTransaction>(`/transactions/${encodeURIComponent(transactionID)}/image`, {
      method: "PATCH", body: JSON.stringify({ fileMetadataID }),
    }),
  fileContentURL: (fileMetadataID: string) => `/file-metadata/${encodeURIComponent(fileMetadataID)}/content`,
  getLocalDatabaseCapabilities: () => request<LocalDatabaseCapabilities>("/local-databases/capabilities"),
  createLocalDatabase: (payload: { databaseName: string; profile: string; confirmCreation: boolean }) =>
    request<LocalDatabaseCreationResult>("/local-databases", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getLiveSchema: () => request<LiveSchema>("/live-database/schema"),
  getSchemaBuilderGuidance: () => request<SchemaBuilderGuidance>("/schema-builder/metadata"),
  previewUserTable: (definition: TableBuilderRequest) => request<UserTablePreview>("/live-database/tables/preview", { method: "POST", body: JSON.stringify(definition) }),
  createUserTable: (confirmationToken: string) => request<UserTableCreationResult>("/live-database/tables/execute", { method: "POST", body: JSON.stringify({ confirmationToken }) }),
  previewHomeInventoryCSV: (csv: string) => request<HomeInventoryCSVPreview>("/home-inventory/import/preview", { method: "POST", body: JSON.stringify({ csv }) }),
  importHomeInventoryCSV: (csv: string) => request<HomeInventoryCSVImportResult>("/home-inventory/import", { method: "POST", body: JSON.stringify({ csv, confirmImport: true }) }),
};
