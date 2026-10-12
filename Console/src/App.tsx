import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import { api } from "./api";
import { useDomainsQuery } from "./data/domainQueries";
import { Notice } from "./components/Notice";
import { DomainSidebar } from "./features/domains/DomainSidebar";
import { ForgeKeeperView } from "./features/forgekeeper/ForgeKeeperView";
import { GemHuesView } from "./features/gem-hues/GemHuesView";
import { EducationView } from "./features/education/EducationView";
import { EmploymentView } from "./features/employment/EmploymentView";
import { AddressesView } from "./features/addresses/AddressesView";
import { TransactionsView } from "./features/transactions/TransactionsView";
import { LocalDatabaseView } from "./features/databases/LocalDatabaseView";
import { SchemaBuilderView } from "./features/schema/SchemaBuilderView";
import type { Address, Domain, Education, Employment, ExpenseTransaction, ForgeKeeperPage, ForgeKeeperPatch, GemHue } from "./types";

type View = "pages" | "hues" | "education" | "employment" | "addresses" | "transactions" | "databases" | "schema";

function viewForPath(pathname: string): View {
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
  const [pages, setPages] = useState<ForgeKeeperPage[]>([]);
  const [hues, setHues] = useState<GemHue[]>([]);
  const [education, setEducation] = useState<Education[]>([]);
  const [employment, setEmployment] = useState<Employment[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [transactions, setTransactions] = useState<ExpenseTransaction[]>([]);
  const [selectedDomainID, setSelectedDomainID] = useState<string | null>(null);
  const [view, setView] = useState<View>(() => viewForPath(window.location.pathname));
  const [notice, setNotice] = useState<{ message: string; kind: "error" | "success" } | null>(null);

  const domainsQuery = useDomainsQuery();

  useEffect(() => {
    if (domainsQuery.data) setDomains(domainsQuery.data);
    if (domainsQuery.error) showError(domainsQuery.error);
  }, [domainsQuery.data, domainsQuery.error]);

  async function refreshDomains() {
    try {
      const result = await domainsQuery.refetch();
      setDomains(result.data ?? []);
      if (selectedDomainID) await selectDomain(selectedDomainID);
    } catch (error) { showError(error); }
  }

  async function selectDomain(domainID: string) {
    try { setView("pages"); setSelectedDomainID(domainID); navigate(`/domains/${domainID}`); setPages(await api.listPagesForDomain(domainID)); }
    catch (error) { showError(error); }
  }

  async function loadRoots() { try { setSelectedDomainID(null); navigate("/forgekeeper"); setPages(await api.listRootPages()); } catch (error) { showError(error); } }
  async function loadChildren(pageID: number) { try { setPages(await api.listChildren(pageID)); } catch (error) { showError(error); } }
  async function patchPage(pageID: number, patch: ForgeKeeperPatch) { try { await api.patchPage(pageID, patch); showSuccess("Page metadata updated."); if (selectedDomainID) await selectDomain(selectedDomainID); else await loadRoots(); } catch (error) { showError(error); throw error; } }
  async function openHues() { try { setView("hues"); navigate("/gemhues"); setHues(await api.listGemHues()); } catch (error) { showError(error); } }
  async function openEducation() { try { setView("education"); navigate("/education"); setEducation(await api.listEducation()); } catch (error) { showError(error); } }
  async function openEmployment() { try { setView("employment"); navigate("/employment"); setEmployment(await api.listEmployment()); } catch (error) { showError(error); } }
  async function openAddresses() { try { setView("addresses"); navigate("/addresses"); setAddresses(await api.listAddresses()); } catch (error) { showError(error); } }
  async function openTransactions() { try { setView("transactions"); navigate("/transactions"); setTransactions(await api.listTransactions()); } catch (error) { showError(error); } }
  function showError(error: unknown) { setNotice({ message: error instanceof Error ? error.message : "Request failed.", kind: "error" }); }
  function showSuccess(message: string) { setNotice({ message, kind: "success" }); window.setTimeout(() => setNotice(null), 3500); }

  const selectedDomain = domains.find((domain) => domain.id === selectedDomainID) ?? null;

  return <div className="app-shell"><header className="topbar"><div><p className="eyebrow">GemsForgeAPI · React testing console</p><h1>Gem Life Console</h1></div><div className="connection-pill"><span /> Local API</div></header><main className="workspace"><DomainSidebar domains={domains} selectedDomainID={selectedDomainID} onSelect={(id) => void selectDomain(id)} onRefresh={() => void refreshDomains()} huesSelected={view === "hues"} onSelectHues={() => void openHues()} educationSelected={view === "education"} onSelectEducation={() => void openEducation()} employmentSelected={view === "employment"} onSelectEmployment={() => void openEmployment()} addressesSelected={view === "addresses"} onSelectAddresses={() => void openAddresses()} transactionsSelected={view === "transactions"} onSelectTransactions={() => void openTransactions()} databasesSelected={view === "databases"} onSelectDatabases={() => { setView("databases"); navigate("/local-databases"); }} schemaSelected={view === "schema"} onSelectSchema={() => { setView("schema"); navigate("/schema-builder"); }} /><section className="content"><Notice message={notice?.message ?? null} kind={notice?.kind} />{view === "hues" ? <GemHuesView hues={hues} /> : view === "education" ? <EducationView records={education} /> : view === "employment" ? <EmploymentView records={employment} /> : view === "addresses" ? <AddressesView records={addresses} /> : view === "transactions" ? <TransactionsView records={transactions} /> : view === "databases" ? <LocalDatabaseView onError={showError} onSuccess={showSuccess} /> : view === "schema" ? <SchemaBuilderView onError={showError} onSuccess={showSuccess} /> : <ForgeKeeperView domain={selectedDomain} pages={pages} onLoadRoots={() => void loadRoots()} onLoadChildren={(id) => void loadChildren(id)} onPatch={patchPage} />}</section></main></div>;
}

export function App() {
  return <BrowserRouter><Routes><Route path="*" element={<ConsoleApp />} /></Routes></BrowserRouter>;
}
