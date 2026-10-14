import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import { usePagesQuery, usePageMutation, type PageScope } from "./data/workflowQueries";
import { useDomainsQuery } from "./data/domainQueries";
import { useAddressesQuery, useEducationQuery, useEmploymentQuery, useGemHuesQuery, useTransactionsQuery } from "./data/lifeQueries";
import { Notice } from "./components/Notice";
import { GemLifeShell } from "./components/layout/GemLifeShell";
import { DomainSidebar } from "./features/domains/DomainSidebar";
import { ForgeKeeperView } from "./features/forgekeeper/ForgeKeeperView";
import { GemHuesView } from "./features/gem-hues/GemHuesView";
import { EducationView } from "./features/education/EducationView";
import { EmploymentView } from "./features/employment/EmploymentView";
import { AddressesView } from "./features/addresses/AddressesView";
import { TransactionsView } from "./features/transactions/TransactionsView";
import { LocalDatabaseView } from "./features/databases/LocalDatabaseView";
import { SchemaBuilderView } from "./features/schema/SchemaBuilderView";
import type { Domain, ForgeKeeperPatch } from "./types";

type View = "pages" | "hues" | "education" | "employment" | "addresses" | "transactions" | "databases" | "schema";

export function viewForPath(pathname: string): View {
  if (pathname.startsWith("/gemhues")) return "hues";
  if (pathname.startsWith("/education")) return "education";
  if (pathname.startsWith("/employment")) return "employment";
  if (pathname.startsWith("/addresses")) return "addresses";
  if (pathname.startsWith("/transactions")) return "transactions";
  if (pathname.startsWith("/local-databases")) return "databases";
  if (pathname.startsWith("/schema-builder")) return "schema";
  return "pages";
}

function ConsoleApp() {
  const navigate = useNavigate();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [pageScope, setPageScope] = useState<PageScope>({ kind: "roots" });
  const [selectedDomainID, setSelectedDomainID] = useState<string | null>(null);
  const [view, setView] = useState<View>(() => viewForPath(window.location.pathname));
  const [notice, setNotice] = useState<{ message: string; kind: "error" | "success" } | null>(null);

  const domainsQuery = useDomainsQuery();
  const huesQuery = useGemHuesQuery(view === "hues");
  const educationQuery = useEducationQuery(view === "education");
  const employmentQuery = useEmploymentQuery(view === "employment");
  const addressesQuery = useAddressesQuery(view === "addresses");
  const transactionsQuery = useTransactionsQuery(view === "transactions");
  const pagesQuery = usePagesQuery(pageScope, view === "pages");
  const pages = pagesQuery.data ?? [];
  const pageMutation = usePageMutation();

  useEffect(() => {
    if (domainsQuery.data) setDomains(domainsQuery.data);
    if (domainsQuery.error) showError(domainsQuery.error);
    if (huesQuery.error) showError(huesQuery.error);
    if (educationQuery.error) showError(educationQuery.error);
    if (employmentQuery.error) showError(employmentQuery.error);
    if (addressesQuery.error) showError(addressesQuery.error);
    if (transactionsQuery.error) showError(transactionsQuery.error);
    if (pagesQuery.error) showError(pagesQuery.error);
  }, [domainsQuery.data, domainsQuery.error, huesQuery.error, educationQuery.error, employmentQuery.error, addressesQuery.error, transactionsQuery.error, pagesQuery.error]);

  async function refreshDomains() {
    try {
      const result = await domainsQuery.refetch();
      setDomains(result.data ?? []);
      if (selectedDomainID) await selectDomain(selectedDomainID);
    } catch (error) { showError(error); }
  }

  async function selectDomain(domainID: string) {
    try { setView("pages"); setSelectedDomainID(domainID); navigate(`/domains/${domainID}`); setPageScope({ kind: "domain", id: domainID }); }
    catch (error) { showError(error); }
  }

  async function loadRoots() { setView("pages"); setSelectedDomainID(null); navigate("/forgekeeper"); setPageScope({ kind: "roots" }); }
  async function loadChildren(pageID: number) { setPageScope({ kind: "children", id: pageID }); }
  async function patchPage(pageID: number, patch: ForgeKeeperPatch) { try { await pageMutation.mutateAsync({ id: pageID, patch }); showSuccess("Page metadata updated."); } catch (error) { showError(error); throw error; } }
  function openHues() { setView("hues"); navigate("/gemhues"); }
  function openEducation() { setView("education"); navigate("/education"); }
  function openEmployment() { setView("employment"); navigate("/employment"); }
  function openAddresses() { setView("addresses"); navigate("/addresses"); }
  function openTransactions() { setView("transactions"); navigate("/transactions"); }
  const showError = useCallback((error: unknown) => { setNotice({ message: error instanceof Error ? error.message : "Request failed.", kind: "error" }); }, []);
  function showSuccess(message: string) { setNotice({ message, kind: "success" }); window.setTimeout(() => setNotice(null), 3500); }

  const selectedDomain = domains.find((domain) => domain.id === selectedDomainID) ?? null;

  return <GemLifeShell sidebar={<DomainSidebar domains={domains} selectedDomainID={selectedDomainID} onSelect={(id) => void selectDomain(id)} onRefresh={() => void refreshDomains()} huesSelected={view === "hues"} onSelectHues={openHues} educationSelected={view === "education"} onSelectEducation={openEducation} employmentSelected={view === "employment"} onSelectEmployment={openEmployment} addressesSelected={view === "addresses"} onSelectAddresses={openAddresses} transactionsSelected={view === "transactions"} onSelectTransactions={openTransactions} databasesSelected={view === "databases"} onSelectDatabases={() => { setView("databases"); navigate("/local-databases"); }} schemaSelected={view === "schema"} onSelectSchema={() => { setView("schema"); navigate("/schema-builder"); }} />}><Notice message={notice?.message ?? null} kind={notice?.kind} />{view === "hues" ? <GemHuesView hues={huesQuery.data ?? []} /> : view === "education" ? <EducationView records={educationQuery.data ?? []} /> : view === "employment" ? <EmploymentView records={employmentQuery.data ?? []} /> : view === "addresses" ? <AddressesView records={addressesQuery.data ?? []} /> : view === "transactions" ? <TransactionsView records={transactionsQuery.data ?? []} /> : view === "databases" ? <LocalDatabaseView onError={showError} onSuccess={showSuccess} /> : view === "schema" ? <SchemaBuilderView onError={showError} onSuccess={showSuccess} /> : <ForgeKeeperView domain={selectedDomain} pages={pages} onLoadRoots={() => void loadRoots()} onLoadChildren={(id) => void loadChildren(id)} onPatch={patchPage} />}</GemLifeShell>;
}

export function App() {
  return <BrowserRouter><Routes><Route path="*" element={<ConsoleApp />} /></Routes></BrowserRouter>;
}
