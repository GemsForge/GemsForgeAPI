import type {
  Address,
  AddressCreate,
  Domain,
  DomainCreate,
  Education,
  EducationCreate,
  Employment,
  EmploymentCreate,
  ExpenseTransaction,
  ExpenseCategory,
  ExpenseSubcategory,
  FileMetadata,
  ForgeKeeperPage,
  ForgeKeeperPatch,
  GemHue,
  HomeInventoryCSVImportResult,
  HomeInventoryCSVPreview,
  LiveSchema,
  LocalDatabaseCapabilities,
  LocalDatabaseCreationResult,
  SchemaBuilderGuidance,
  ServiceAccount,
  ServiceAccountCreate,
  TransactionCreate,
  TableBuilderRequest,
  UserTableCreationResult,
  UserTablePreview,
} from "./types";
import { getBearerToken, notifySessionExpired } from "./auth/session";

export interface APIAuthenticationSession {
  sessionToken: string;
  expiresAt: string;
}

export class APIError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "APIError";
  }
}

async function checkedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  let response: Response;
  const headers = new Headers(options.headers);
  const isPublicAuthRequest = path === "/auth/supabase" || path === "/auth/local";
  const bearerToken = path === "/health" || isPublicAuthRequest ? null : getBearerToken();
  if (bearerToken) headers.set("Authorization", `Bearer ${bearerToken}`);
  try {
    response = await fetch(path, { cache: "no-store", ...options, headers });
  } catch (error) {
    if (options.signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
    throw new APIError("Cannot reach Gem Life. Check that the local API is running.", 0);
  }
  if (!response.ok) {
    if (response.status === 401 && bearerToken) notifySessionExpired();
    const problem = await response.json().catch(() => ({}));
    throw new APIError(
      typeof problem?.reason === "string" ? problem.reason : `${response.status} ${response.statusText}`,
      response.status,
    );
  }
  return response;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await checkedFetch(path, { ...options, headers });
  return response.status === 204 ? (null as T) : ((await response.json()) as T);
}

export const api = {
  getHealth: async (signal?: AbortSignal) => {
    const response = await checkedFetch("/health", { signal });
    if ((await response.text()).trim() !== "ok")
      throw new APIError("The local API returned an unexpected health response.", response.status);
    return true;
  },
  exchangeSupabaseIdentityToken: (accessToken: string) =>
    request<APIAuthenticationSession>("/auth/supabase", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  localSignIn: (username: string, password: string) =>
    request<APIAuthenticationSession>("/auth/local", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  listDomains: (signal?: AbortSignal) => request<Domain[]>("/domains", { signal }),
  createDomain: (payload: DomainCreate) =>
    request<Domain>("/domains", { method: "POST", body: JSON.stringify(payload) }),
  patchDomain: (domainID: string, patch: Partial<Pick<Domain, "title" | "description">>) =>
    request<Domain>(`/domains/${encodeURIComponent(domainID)}`, { method: "PATCH", body: JSON.stringify(patch) }),
  listPagesForDomain: (domainID: string, signal?: AbortSignal) =>
    request<ForgeKeeperPage[]>(`/domains/${encodeURIComponent(domainID)}/forgekeeper`, { signal }),
  listRootPages: (signal?: AbortSignal) => request<ForgeKeeperPage[]>("/forgekeeper/roots", { signal }),
  listChildren: (pageID: number, signal?: AbortSignal) =>
    request<ForgeKeeperPage[]>(`/forgekeeper/${pageID}/children`, { signal }),
  patchPage: (pageID: number, patch: ForgeKeeperPatch) =>
    request<ForgeKeeperPage>(`/forgekeeper/${pageID}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  listGemHues: (signal?: AbortSignal) => request<GemHue[]>("/gemhues", { signal }),
  getGemHue: (hueID: string, signal?: AbortSignal) =>
    request<GemHue>(`/gemhues/${encodeURIComponent(hueID)}`, { signal }),
  patchGemHue: (hueID: string, patch: Partial<GemHue>) =>
    request<GemHue>(`/gemhues/${encodeURIComponent(hueID)}`, { method: "PATCH", body: JSON.stringify(patch) }),
  getGemHueImage: (hueID: string, signal?: AbortSignal) =>
    checkedFetch(`/gemhues/${encodeURIComponent(hueID)}/image`, { signal }),
  listEducation: (signal?: AbortSignal) => request<Education[]>("/education", { signal }),
  createEducation: (payload: EducationCreate) =>
    request<Education>("/education", { method: "POST", body: JSON.stringify(payload) }),
  getEducation: (educationID: string, signal?: AbortSignal) =>
    request<Education>(`/education/${encodeURIComponent(educationID)}`, { signal }),
  patchEducation: (educationID: string, patch: Partial<Education>) =>
    request<Education>(`/education/${encodeURIComponent(educationID)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  listEmployment: (signal?: AbortSignal) => request<Employment[]>("/employment", { signal }),
  createEmployment: (payload: EmploymentCreate) =>
    request<Employment>("/employment", { method: "POST", body: JSON.stringify(payload) }),
  getEmployment: (employmentID: string, signal?: AbortSignal) =>
    request<Employment>(`/employment/${encodeURIComponent(employmentID)}`, { signal }),
  patchEmployment: (employmentID: string, patch: Partial<Employment>) =>
    request<Employment>(`/employment/${encodeURIComponent(employmentID)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  listAddresses: (signal?: AbortSignal) => request<Address[]>("/addresses", { signal }),
  createAddress: (payload: AddressCreate) =>
    request<Address>("/addresses", { method: "POST", body: JSON.stringify(payload) }),
  getAddress: (addressID: string, signal?: AbortSignal) =>
    request<Address>(`/addresses/${encodeURIComponent(addressID)}`, { signal }),
  patchAddress: (addressID: string, patch: Partial<Address>) =>
    request<Address>(`/addresses/${encodeURIComponent(addressID)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  listTransactions: (signal?: AbortSignal) => request<ExpenseTransaction[]>("/transactions", { signal }),
  listExpenseCategories: (signal?: AbortSignal) => request<ExpenseCategory[]>("/expense-categories", { signal }),
  listExpenseSubcategories: (categoryID: number | null, signal?: AbortSignal) =>
    request<ExpenseSubcategory[]>(`/expense-subcategories${categoryID === null ? "" : `?categoryID=${categoryID}`}`, {
      signal,
    }),
  createTransaction: (payload: TransactionCreate) =>
    request<ExpenseTransaction>("/transactions", { method: "POST", body: JSON.stringify(payload) }),
  getTransaction: (transactionID: string, signal?: AbortSignal) =>
    request<ExpenseTransaction>(`/transactions/${encodeURIComponent(transactionID)}`, { signal }),
  patchTransaction: (transactionID: string, patch: Partial<ExpenseTransaction>) =>
    request<ExpenseTransaction>(`/transactions/${encodeURIComponent(transactionID)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  listServiceAccounts: (signal?: AbortSignal) => request<ServiceAccount[]>("/service-accounts", { signal }),
  createServiceAccount: (payload: ServiceAccountCreate) =>
    request<ServiceAccount>("/service-accounts", { method: "POST", body: JSON.stringify(payload) }),
  getServiceAccount: (serviceID: number, signal?: AbortSignal) =>
    request<ServiceAccount>(`/service-accounts/${serviceID}`, { signal }),
  patchServiceAccount: (serviceID: number, patch: Partial<ServiceAccount>) =>
    request<ServiceAccount>(`/service-accounts/${serviceID}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  uploadImage: async (file: File, fileKind: string, ownerType: string, ownerID: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("fileKind", fileKind);
    form.append("ownerType", ownerType);
    form.append("ownerID", ownerID);
    const response = await checkedFetch("/file-uploads", { method: "POST", body: form });
    return (await response.json()) as FileMetadata;
  },
  patchAddressAttachment: (addressID: string, fileMetadataID: string | null) =>
    request<Address>(`/addresses/${encodeURIComponent(addressID)}/attachment`, {
      method: "PATCH",
      body: JSON.stringify({ fileMetadataID }),
    }),
  patchTransactionImage: (transactionID: string, fileMetadataID: string | null) =>
    request<ExpenseTransaction>(`/transactions/${encodeURIComponent(transactionID)}/image`, {
      method: "PATCH",
      body: JSON.stringify({ fileMetadataID }),
    }),
  fileContentURL: (fileMetadataID: string) => `/file-metadata/${encodeURIComponent(fileMetadataID)}/content`,
  getFileMetadata: (id: string, signal?: AbortSignal) =>
    request<FileMetadata>(`/file-metadata/${encodeURIComponent(id)}`, { signal }),
  getFileContent: async (id: string, signal: AbortSignal) => {
    const response = await checkedFetch(api.fileContentURL(id), { signal });
    return response.blob();
  },
  getLocalDatabaseCapabilities: (signal?: AbortSignal) =>
    request<LocalDatabaseCapabilities>("/local-databases/capabilities", { signal }),
  createLocalDatabase: (payload: { databaseName: string; profile: string; confirmCreation: boolean }) =>
    request<LocalDatabaseCreationResult>("/local-databases", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getLiveSchema: (signal?: AbortSignal) => request<LiveSchema>("/live-database/schema", { signal }),
  previewRepositoryMigrations: () =>
    request<import("./types").LiveRepositoryMigrationPreview>("/live-database/repository-migrations/preview", {
      method: "POST",
    }),
  executeRepositoryMigrations: (confirmationToken: string) =>
    request<import("./types").LiveRepositoryMigrationExecution>("/live-database/repository-migrations/execute", {
      method: "POST",
      body: JSON.stringify({ confirmationToken }),
    }),
  getSchemaBuilderGuidance: (signal?: AbortSignal) =>
    request<SchemaBuilderGuidance>("/schema-builder/metadata", { signal }),
  previewUserTable: (definition: TableBuilderRequest) =>
    request<UserTablePreview>("/live-database/tables/preview", { method: "POST", body: JSON.stringify(definition) }),
  createUserTable: (confirmationToken: string) =>
    request<UserTableCreationResult>("/live-database/tables/execute", {
      method: "POST",
      body: JSON.stringify({ confirmationToken }),
    }),
  previewHomeInventoryCSV: (csv: string) =>
    request<HomeInventoryCSVPreview>("/home-inventory/import/preview", {
      method: "POST",
      body: JSON.stringify({ csv }),
    }),
  importHomeInventoryCSV: (csv: string) =>
    request<HomeInventoryCSVImportResult>("/home-inventory/import", {
      method: "POST",
      body: JSON.stringify({ csv, confirmImport: true }),
    }),
};
