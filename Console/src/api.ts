import type { Address, Domain, Education, Employment, ExpenseTransaction, FileMetadata, ForgeKeeperPage, ForgeKeeperPatch, GemHue, HomeInventoryCSVImportResult, HomeInventoryCSVPreview, LiveRepositoryMigrationExecution, LiveRepositoryMigrationPreview, LiveSchema, LocalDatabaseCapabilities, LocalDatabaseCreationResult, SchemaBuilderGuidance, TableBuilderRequest, UserTableCreationResult, UserTablePreview } from "./types";

export class APIError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "APIError";
  }
}

async function checkedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  let response: Response;
  try { response = await fetch(path, { cache: "no-store", ...options }); }
  catch (error) {
    if (options.signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
    throw new APIError("Cannot reach Gem Life. Check that the local API is running.", 0);
  }
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new APIError(typeof problem?.reason === "string" ? problem.reason : `${response.status} ${response.statusText}`, response.status);
  }
  return response;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await checkedFetch(path, { ...options, headers });
  return response.status === 204 ? (null as T) : (await response.json() as T);
}

export const api = {
  getHealth: async (signal?: AbortSignal) => {
    const response = await checkedFetch("/health", { signal });
    if ((await response.text()).trim() !== "ok") throw new APIError("The local API returned an unexpected health response.", response.status);
    return true;
  },
  listDomains: (signal?: AbortSignal) => request<Domain[]>("/domains", { signal }),
  listPagesForDomain: (domainID: string, signal?: AbortSignal) =>
    request<ForgeKeeperPage[]>(`/domains/${encodeURIComponent(domainID)}/forgekeeper`, { signal }),
  listRootPages: (signal?: AbortSignal) => request<ForgeKeeperPage[]>("/forgekeeper/roots", { signal }),
  listChildren: (pageID: number, signal?: AbortSignal) => request<ForgeKeeperPage[]>(`/forgekeeper/${pageID}/children`, { signal }),
  patchPage: (pageID: number, patch: ForgeKeeperPatch) =>
    request<ForgeKeeperPage>(`/forgekeeper/${pageID}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  listGemHues: (signal?: AbortSignal) => request<GemHue[]>("/gemhues", { signal }),
  getGemHue: (hueID: string, signal?: AbortSignal) => request<GemHue>(`/gemhues/${encodeURIComponent(hueID)}`, { signal }),
  getGemHueImage: (hueID: string, signal?: AbortSignal) => checkedFetch(`/gemhues/${encodeURIComponent(hueID)}/image`, { signal }),
  listEducation: (signal?: AbortSignal) => request<Education[]>("/education", { signal }),
  getEducation: (educationID: string, signal?: AbortSignal) =>
    request<Education>(`/education/${encodeURIComponent(educationID)}`, { signal }),
  listEmployment: (signal?: AbortSignal) => request<Employment[]>("/employment", { signal }),
  getEmployment: (employmentID: string, signal?: AbortSignal) =>
    request<Employment>(`/employment/${encodeURIComponent(employmentID)}`, { signal }),
  listAddresses: (signal?: AbortSignal) => request<Address[]>("/addresses", { signal }),
  getAddress: (addressID: string, signal?: AbortSignal) =>
    request<Address>(`/addresses/${encodeURIComponent(addressID)}`, { signal }),
  listTransactions: (signal?: AbortSignal) => request<ExpenseTransaction[]>("/transactions", { signal }),
  getTransaction: (transactionID: string, signal?: AbortSignal) =>
    request<ExpenseTransaction>(`/transactions/${encodeURIComponent(transactionID)}`, { signal }),
  uploadImage: async (file: File, fileKind: string, ownerType: string, ownerID: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("fileKind", fileKind);
    form.append("ownerType", ownerType);
    form.append("ownerID", ownerID);
    const response = await checkedFetch("/file-uploads", { method: "POST", body: form });
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
  getFileMetadata: (id: string, signal?: AbortSignal) =>
    request<FileMetadata>(`/file-metadata/${encodeURIComponent(id)}`, { signal }),
  getFileContent: async (id: string, signal: AbortSignal) => {
    const response = await checkedFetch(api.fileContentURL(id), { signal });
    return response.blob();
  },
  getLocalDatabaseCapabilities: (signal?: AbortSignal) => request<LocalDatabaseCapabilities>("/local-databases/capabilities", { signal }),
  createLocalDatabase: (payload: { databaseName: string; profile: string; confirmCreation: boolean }) =>
    request<LocalDatabaseCreationResult>("/local-databases", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getLiveSchema: (signal?: AbortSignal) => request<LiveSchema>("/live-database/schema", { signal }),
  previewRepositoryMigrations: () => request<LiveRepositoryMigrationPreview>("/live-database/repository-migrations/preview", { method: "POST" }),
  executeRepositoryMigrations: (confirmationToken: string) => request<LiveRepositoryMigrationExecution>("/live-database/repository-migrations/execute", { method: "POST", body: JSON.stringify({ confirmationToken }) }),
  getSchemaBuilderGuidance: (signal?: AbortSignal) => request<SchemaBuilderGuidance>("/schema-builder/metadata", { signal }),
  previewUserTable: (definition: TableBuilderRequest) => request<UserTablePreview>("/live-database/tables/preview", { method: "POST", body: JSON.stringify(definition) }),
  createUserTable: (confirmationToken: string) => request<UserTableCreationResult>("/live-database/tables/execute", { method: "POST", body: JSON.stringify({ confirmationToken }) }),
  previewHomeInventoryCSV: (csv: string) => request<HomeInventoryCSVPreview>("/home-inventory/import/preview", { method: "POST", body: JSON.stringify({ csv }) }),
  importHomeInventoryCSV: (csv: string) => request<HomeInventoryCSVImportResult>("/home-inventory/import", { method: "POST", body: JSON.stringify({ csv, confirmImport: true }) }),
};
