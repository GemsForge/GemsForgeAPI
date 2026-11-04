import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BookOpenText, Network } from "lucide-react";
import { DomainCreateForm } from "../create/RecordCreateForms";
import { QueryFeedback } from "../../components/QueryFeedback";
import { useCreateDomainMutation, useDomainsQuery } from "../../data/domainQueries";
import { usePageMutation, usePagesQuery, type PageScope } from "../../data/workflowQueries";
import { ForgeKeeperView } from "../forgekeeper/ForgeKeeperView";
import { WireframeSystemPage } from "./WireframeSystemPages";

export function WireframeDomainsPage() {
  const domains = useDomainsQuery();
  const createDomain = useCreateDomainMutation();
  const [creating, setCreating] = useState(false);
  const records = domains.data ?? [];

  return (
    <WireframeSystemPage
      title="Domains"
      description="Organize and open the ForgeKeeper pages in each part of your workspace."
      count={records.length}
    >
      <div className="wireframe-system-page-actions">
        <button
          type="button"
          className="wireframe-system-action"
          onClick={() => setCreating((value) => !value)}
          aria-expanded={creating}
        >
          {creating ? "Cancel" : "Add domain"}
        </button>
      </div>
      {creating ? (
        <DomainCreateForm
          onCancel={() => setCreating(false)}
          onCreate={async (payload) => {
            await createDomain.mutateAsync(payload);
            setCreating(false);
          }}
        />
      ) : null}
      <QueryFeedback query={domains} />
      {domains.data ? (
        records.length ? (
          <section className="wireframe-system-domain-grid" aria-label="Domains">
            {records.map((domain) => (
              <Link
                className="wireframe-system-card wireframe-system-domain-card"
                to={`/forgekeeper-wireframe/domain/${encodeURIComponent(domain.id)}`}
                key={domain.id}
                aria-label={`Open ForgeKeeper pages in ${domain.title}`}
              >
                <span className="wireframe-system-card-icon">
                  <Network size={20} aria-hidden="true" />
                </span>
                <span className="wireframe-system-card-copy">
                  <strong>{domain.title}</strong>
                  <small>{domain.description || "No description"}</small>
                </span>
                <span className="wireframe-system-card-arrow" aria-hidden="true">
                  ↗
                </span>
              </Link>
            ))}
          </section>
        ) : (
          <section className="wireframe-empty-state">
            <strong>No domains yet</strong>
            <p>Create a domain to organize its ForgeKeeper pages.</p>
          </section>
        )
      ) : null}
    </WireframeSystemPage>
  );
}

type ForgeKeeperScope = PageScope["kind"];

export function WireframeForgeKeeperPage({ kind }: { kind: ForgeKeeperScope }) {
  const { domainID, pageID } = useParams();
  const navigate = useNavigate();
  const domains = useDomainsQuery();
  const mutation = usePageMutation();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const validPageID =
    pageID !== undefined && /^\d+$/.test(pageID) && Number.isSafeInteger(Number(pageID)) && Number(pageID) > 0;
  const domain = domains.data?.find((item) => item.id === domainID) ?? null;
  const scope: PageScope =
    kind === "domain" && domainID
      ? { kind, id: domainID }
      : kind === "children" && validPageID
        ? { kind, id: Number(pageID) }
        : { kind: "roots" };
  const enabled = kind === "roots" || (kind === "domain" && domain !== null) || (kind === "children" && validPageID);
  const pages = usePagesQuery(scope, enabled);

  return (
    <WireframeSystemPage
      title="ForgeKeeper"
      description="Browse and update the pages stored in your workspace."
      count={pages.data?.length ?? 0}
    >
      <section className="wireframe-system-domain-picker" aria-label="ForgeKeeper scope">
        <Link
          className={`wireframe-system-scope-link${kind === "roots" ? " is-active" : ""}`}
          to="/forgekeeper-wireframe"
          aria-current={kind === "roots" ? "page" : undefined}
        >
          All root pages
        </Link>
        {domains.data?.map((item) => (
          <Link
            className={`wireframe-system-scope-link${item.id === domainID ? " is-active" : ""}`}
            to={`/forgekeeper-wireframe/domain/${encodeURIComponent(item.id)}`}
            key={item.id}
            aria-current={item.id === domainID ? "page" : undefined}
          >
            {item.title}
          </Link>
        ))}
      </section>
      <QueryFeedback query={domains} />
      <QueryFeedback query={pages} />
      {kind === "domain" && domains.data && !domain ? (
        <section className="wireframe-empty-state">
          <strong>Domain unavailable</strong>
          <p>This domain may have been removed. Choose another domain to continue.</p>
        </section>
      ) : null}
      {kind === "children" && !validPageID ? (
        <section className="wireframe-empty-state">
          <strong>Page unavailable</strong>
          <p>The requested page ID is invalid.</p>
        </section>
      ) : null}
      {notice ? (
        <p className="wireframe-system-success" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="wireframe-system-error" role="alert">
          {error}
        </p>
      ) : null}
      {pages.data ? (
        <ForgeKeeperView
          domain={domain}
          pages={pages.data}
          onLoadRoots={() => navigate("/forgekeeper-wireframe")}
          onLoadChildren={(id) => navigate(`/forgekeeper-wireframe/${id}/children`)}
          onPatch={async (id, patch) => {
            setError(null);
            setNotice(null);
            try {
              await mutation.mutateAsync({ id, patch });
              setNotice("Page metadata saved.");
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "The page could not be saved.");
              throw caught;
            }
          }}
        />
      ) : null}
      {!pages.isPending && !pages.data && enabled ? (
        <section className="wireframe-empty-state">
          <BookOpenText size={24} aria-hidden="true" />
          <strong>No pages are available</strong>
          <p>Choose a domain or show all root pages.</p>
        </section>
      ) : null}
    </WireframeSystemPage>
  );
}
