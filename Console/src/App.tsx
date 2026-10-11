import { useEffect, useState } from "react";
import { api } from "./api";
import { Notice } from "./components/Notice";
import { DomainSidebar } from "./features/domains/DomainSidebar";
import { ForgeKeeperView } from "./features/forgekeeper/ForgeKeeperView";
import { GemHuesView } from "./features/gem-hues/GemHuesView";
import { EducationView } from "./features/education/EducationView";
import type { Domain, Education, ForgeKeeperPage, ForgeKeeperPatch, GemHue } from "./types";

export function App() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [pages, setPages] = useState<ForgeKeeperPage[]>([]);
  const [hues, setHues] = useState<GemHue[]>([]);
  const [education, setEducation] = useState<Education[]>([]);
  const [selectedDomainID, setSelectedDomainID] = useState<string | null>(null);
  const [view, setView] = useState<"pages" | "hues" | "education">("pages");
  const [notice, setNotice] = useState<{ message: string; kind: "error" | "success" } | null>(null);

  useEffect(() => { void refreshDomains(); }, []);

  async function refreshDomains() {
    try {
      const result = await api.listDomains();
      setDomains(result);
      if (selectedDomainID) await selectDomain(selectedDomainID);
    } catch (error) { showError(error); }
  }

  async function selectDomain(domainID: string) {
    try { setView("pages"); setSelectedDomainID(domainID); setPages(await api.listPagesForDomain(domainID)); }
    catch (error) { showError(error); }
  }

  async function loadRoots() { try { setSelectedDomainID(null); setPages(await api.listRootPages()); } catch (error) { showError(error); } }
  async function loadChildren(pageID: number) { try { setPages(await api.listChildren(pageID)); } catch (error) { showError(error); } }
  async function patchPage(pageID: number, patch: ForgeKeeperPatch) { try { await api.patchPage(pageID, patch); showSuccess("Page metadata updated."); if (selectedDomainID) await selectDomain(selectedDomainID); else await loadRoots(); } catch (error) { showError(error); throw error; } }
  async function openHues() { try { setView("hues"); setHues(await api.listGemHues()); } catch (error) { showError(error); } }
  async function openEducation() { try { setView("education"); setEducation(await api.listEducation()); } catch (error) { showError(error); } }
  function showError(error: unknown) { setNotice({ message: error instanceof Error ? error.message : "Request failed.", kind: "error" }); }
  function showSuccess(message: string) { setNotice({ message, kind: "success" }); window.setTimeout(() => setNotice(null), 3500); }

  const selectedDomain = domains.find((domain) => domain.id === selectedDomainID) ?? null;

  return <div className="app-shell"><header className="topbar"><div><p className="eyebrow">GemsForgeAPI · React testing console</p><h1>Gem Life Console</h1></div><div className="connection-pill"><span /> Local API</div></header><main className="workspace"><DomainSidebar domains={domains} selectedDomainID={selectedDomainID} onSelect={(id) => void selectDomain(id)} onRefresh={() => void refreshDomains()} huesSelected={view === "hues"} onSelectHues={() => void openHues()} educationSelected={view === "education"} onSelectEducation={() => void openEducation()} /><section className="content"><Notice message={notice?.message ?? null} kind={notice?.kind} />{view === "hues" ? <GemHuesView hues={hues} /> : view === "education" ? <EducationView records={education} /> : <ForgeKeeperView domain={selectedDomain} pages={pages} onLoadRoots={() => void loadRoots()} onLoadChildren={(id) => void loadChildren(id)} onPatch={patchPage} />}</section></main></div>;
}
