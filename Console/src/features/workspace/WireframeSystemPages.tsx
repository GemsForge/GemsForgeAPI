import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Database,
  GraduationCap,
  MapPin,
  BriefcaseBusiness,
  Gem,
  ReceiptText,
  Wrench,
  BookOpenText,
  Settings2,
  Trash2,
} from "lucide-react";
import { QueryFeedback } from "../../components/QueryFeedback";
import { useLocalDatabasesQuery, usePagesQuery } from "../../data/workflowQueries";
import { useDomainsQuery } from "../../data/domainQueries";
import {
  usePermanentlyDeleteTrashEntryMutation,
  useRestoreTrashEntryMutation,
  useTrashEntriesQuery,
} from "../../data/trashQueries";
import {
  useAddressesQuery,
  useEducationQuery,
  useEmploymentQuery,
  useGemHuesQuery,
  useServiceAccountsQuery,
  useTransactionsQuery,
} from "../../data/lifeQueries";
import { WireframeLeftPane } from "./WireframeLeftPane";
import { WireframePageView } from "./WireframePageView";
import { useWireframeNavigation } from "./WireframeAppHeader";

export function WireframeSystemPage({
  children,
  title,
  description,
  count,
  countLabel,
  showCount,
  activeCollection = "",
}: {
  children: ReactNode;
  title: string;
  description: string;
  count: number;
  countLabel?: { singular: string; plural: string };
  showCount?: boolean;
  activeCollection?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const navigation = useWireframeNavigation();
  const mobileOpen = navigation?.open ?? false;

  return (
    <section className="wireframe-demo wireframe-standalone inspector-closed">
      <div id="wireframe-navigation" className={mobileOpen ? "wireframe-mobile-nav is-open" : "wireframe-mobile-nav"}>
        {mobileOpen ? (
          <button
            type="button"
            className="wireframe-nav-backdrop"
            aria-label="Close navigation"
            onClick={() => navigation?.close()}
          />
        ) : null}
        <WireframeLeftPane
          recordCount={0}
          activeCollection={activeCollection}
          collapsed={mobileOpen ? false : collapsed}
          onToggleCollapsed={() => setCollapsed((value) => !value)}
          onCloseNavigation={navigation ? navigation.close : undefined}
          mobileDrawerOpen={mobileOpen}
        />
      </div>
      <WireframePageView
        title={title}
        description={description}
        recordCount={count}
        countLabel={countLabel}
        showCount={showCount}
      >
        {children}
      </WireframePageView>
    </section>
  );
}

const collectionCards = [
  { label: "Education", href: "/education-wireframe", icon: GraduationCap },
  { label: "Employment", href: "/employment-wireframe", icon: BriefcaseBusiness },
  { label: "Addresses", href: "/addresses-wireframe", icon: MapPin },
  { label: "Expense Tracker", href: "/transactions-wireframe", icon: ReceiptText },
  { label: "Gem Hues", href: "/gemhues-wireframe", icon: Gem },
  { label: "Services", href: "/service-catalog-wireframe", icon: Wrench },
] as const;

export function WireframeHomePage() {
  const domains = useDomainsQuery();
  const rootPages = usePagesQuery({ kind: "roots" });
  const education = useEducationQuery(true);
  const employment = useEmploymentQuery(true);
  const addresses = useAddressesQuery(true);
  const transactions = useTransactionsQuery(true);
  const hues = useGemHuesQuery(true);
  const services = useServiceAccountsQuery(true);
  const recordCounts = {
    Education: education.data?.length ?? 0,
    Employment: employment.data?.length ?? 0,
    Addresses: addresses.data?.length ?? 0,
    "Expense Tracker": transactions.data?.length ?? 0,
    "Gem Hues": hues.data?.length ?? 0,
    Services: services.data?.length ?? 0,
  };
  const total = Object.values(recordCounts).reduce((sum, count) => sum + (count ?? 0), 0);

  return (
    <WireframeSystemPage title="Home" description="Your Gem Life workspace at a glance." count={total}>
      <section className="wireframe-system-card-grid" aria-label="Collections">
        {collectionCards.map((item) => {
          const Icon = item.icon;
          return (
            <Link className="wireframe-system-card" to={item.href} key={item.label}>
              <span className="wireframe-system-card-icon">
                <Icon size={20} aria-hidden="true" />
              </span>
              <span className="wireframe-system-card-copy">
                <strong>{item.label}</strong>
                <small>{recordCounts[item.label] ?? "—"} records</small>
              </span>
              <span className="wireframe-system-card-arrow" aria-hidden="true">
                ↗
              </span>
            </Link>
          );
        })}
        <Link className="wireframe-system-card" to="/local-databases-wireframe">
          <span className="wireframe-system-card-icon">
            <Database size={20} aria-hidden="true" />
          </span>
          <span className="wireframe-system-card-copy">
            <strong>Local Databases</strong>
            <small>Development tools</small>
          </span>
          <span className="wireframe-system-card-arrow" aria-hidden="true">
            ↗
          </span>
        </Link>
        <Link className="wireframe-system-card" to="/domains-wireframe">
          <span className="wireframe-system-card-icon">
            <Settings2 size={20} aria-hidden="true" />
          </span>
          <span className="wireframe-system-card-copy">
            <strong>Domains</strong>
            <small>{domains.data?.length ?? "—"} domains</small>
          </span>
          <span className="wireframe-system-card-arrow" aria-hidden="true">
            ↗
          </span>
        </Link>
        <Link className="wireframe-system-card" to="/forgekeeper-wireframe">
          <span className="wireframe-system-card-icon">
            <BookOpenText size={20} aria-hidden="true" />
          </span>
          <span className="wireframe-system-card-copy">
            <strong>ForgeKeeper</strong>
            <small>{rootPages.data?.length ?? "—"} root pages</small>
          </span>
          <span className="wireframe-system-card-arrow" aria-hidden="true">
            ↗
          </span>
        </Link>
      </section>
    </WireframeSystemPage>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function WireframeDatabasesPage() {
  const query = useLocalDatabasesQuery();
  const databases = query.data ?? [];

  return (
    <WireframeSystemPage
      title="Local Databases"
      description="Development databases available in the configured safe folder. The personal database is excluded."
      count={databases.length}
      countLabel={{ singular: "database", plural: "databases" }}
    >
      <div className="wireframe-system-page-actions">
        <Link className="wireframe-system-action" to="/local-database-wireframe">
          Create database
        </Link>
      </div>
      <QueryFeedback query={query} />
      {query.data ? (
        databases.length ? (
          <section className="wireframe-system-database-list" aria-label="Existing databases">
            {databases.map((database) => (
              <article className="wireframe-system-database-card" key={database.databaseName}>
                <span className="wireframe-system-card-icon">
                  <Database size={20} aria-hidden="true" />
                </span>
                <div>
                  <h3>{database.databaseName}</h3>
                  <p>{formatFileSize(database.fileSizeBytes)}</p>
                </div>
                <span className="wireframe-system-database-status">Available</span>
              </article>
            ))}
          </section>
        ) : (
          <section className="wireframe-empty-state">
            <strong>No development databases yet</strong>
            <p>Create an isolated SQLite database to start a development workspace.</p>
          </section>
        )
      ) : null}
    </WireframeSystemPage>
  );
}

export function WireframeSettingsPage() {
  return (
    <WireframeSystemPage
      title="Application Settings"
      description="Workspace tools and local development configuration."
      count={4}
      countLabel={{ singular: "tool", plural: "tools" }}
    >
      <section className="wireframe-system-card-grid" aria-label="Application tools">
        <Link className="wireframe-system-card" to="/local-databases-wireframe">
          <span className="wireframe-system-card-icon">
            <Database size={20} aria-hidden="true" />
          </span>
          <span className="wireframe-system-card-copy">
            <strong>Local Databases</strong>
            <small>Inspect safe development databases</small>
          </span>
          <span className="wireframe-system-card-arrow" aria-hidden="true">
            ↗
          </span>
        </Link>
        <Link className="wireframe-system-card" to="/local-database-wireframe">
          <span className="wireframe-system-card-icon">
            <Database size={20} aria-hidden="true" />
          </span>
          <span className="wireframe-system-card-copy">
            <strong>Create database</strong>
            <small>Create an isolated development database</small>
          </span>
          <span className="wireframe-system-card-arrow" aria-hidden="true">
            ↗
          </span>
        </Link>
        <Link className="wireframe-system-card" to="/schema-builder-wireframe">
          <span className="wireframe-system-card-icon">
            <Settings2 size={20} aria-hidden="true" />
          </span>
          <span className="wireframe-system-card-copy">
            <strong>Schema Builder</strong>
            <small>Review supported table tools</small>
          </span>
          <span className="wireframe-system-card-arrow" aria-hidden="true">
            ↗
          </span>
        </Link>
        <Link className="wireframe-system-card" to="/live-database-wireframe">
          <span className="wireframe-system-card-icon">
            <Database size={20} aria-hidden="true" />
          </span>
          <span className="wireframe-system-card-copy">
            <strong>Live Database</strong>
            <small>Inspect the configured schema</small>
          </span>
          <span className="wireframe-system-card-arrow" aria-hidden="true">
            ↗
          </span>
        </Link>
      </section>
    </WireframeSystemPage>
  );
}

export function WireframeTrashPage() {
  const query = useTrashEntriesQuery();
  const restore = useRestoreTrashEntryMutation();
  const permanentlyDelete = usePermanentlyDeleteTrashEntryMutation();
  const [actionError, setActionError] = useState<string | null>(null);
  const entries = query.data ?? [];

  const permanentlyDeleteEntry = async (entryID: string, title: string) => {
    if (!window.confirm(`Permanently delete “${title}”? This cannot be undone.`)) return;
    setActionError(null);
    try {
      await permanentlyDelete.mutateAsync(entryID);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The record could not be deleted.");
    }
  };

  const restoreEntry = async (entryID: string) => {
    setActionError(null);
    try {
      await restore.mutateAsync(entryID);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The record could not be restored.");
    }
  };

  return (
    <WireframeSystemPage
      title="Trash"
      description="Restore archived records or permanently remove them."
      count={entries.length}
      countLabel={{ singular: "record", plural: "records" }}
    >
      <QueryFeedback query={query} />
      {actionError ? (
        <p className="wireframe-system-error" role="alert">
          {actionError}
        </p>
      ) : null}
      {query.data ? (
        entries.length ? (
          <section className="wireframe-system-trash-list" aria-label="Archived records">
            {entries.map((entry) => (
              <article className="wireframe-system-trash-card" key={entry.entryID}>
                <span className="wireframe-system-card-icon">
                  <Trash2 size={20} aria-hidden="true" />
                </span>
                <div className="wireframe-system-trash-copy">
                  <h3>{entry.title}</h3>
                  <p>
                    {entry.tableName} · {entry.recordID}
                  </p>
                  <details>
                    <summary>Record details</summary>
                    <pre>{entry.snapshot}</pre>
                  </details>
                </div>
                <div className="wireframe-system-trash-actions">
                  <button type="button" disabled={restore.isPending} onClick={() => void restoreEntry(entry.entryID)}>
                    Restore
                  </button>
                  <button
                    type="button"
                    className="is-danger"
                    disabled={permanentlyDelete.isPending}
                    onClick={() => void permanentlyDeleteEntry(entry.entryID, entry.title)}
                  >
                    Delete permanently
                  </button>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="wireframe-empty-state">
            <strong>Trash is empty</strong>
            <p>Records moved to Trash will appear here.</p>
          </section>
        )
      ) : null}
    </WireframeSystemPage>
  );
}
