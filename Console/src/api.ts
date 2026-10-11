import type { Address, Domain, Education, Employment, ExpenseTransaction, ForgeKeeperPage, ForgeKeeperPatch, GemHue } from "./types";

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
};
