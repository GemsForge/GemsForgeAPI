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
  FileSpreadsheet,
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
import { useWireframeShell } from "./WireframeAppShell";
import { WireframePageView } from "./WireframePageView";

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
  useWireframeShell({ recordCount: 0, activeCollection });

  return (
    <WireframePageView
      title={title}
      description={description}
      recordCount={count}
      countLabel={countLabel}
      showCount={showCount}
    >
      {children}
    </WireframePageView>
  );
}

const collectionCards = [
  { label: "Education", href: "/education", icon: GraduationCap },
  { label: "Employment", href: "/employment", icon: BriefcaseBusiness },
  { label: "Addresses", href: "/addresses", icon: MapPin },
  { label: "Expense Tracker", href: "/transactions", icon: ReceiptText },
  { label: "Gem Hues", href: "/gemhues", icon: Gem },
  { label: "Services", href: "/service-accounts", icon: Wrench },
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
        <Link className="wireframe-system-card" to="/local-databases">
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
        <Link className="wireframe-system-card" to="/domains">
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
        <Link className="wireframe-system-card" to="/forgekeeper">
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
        <Link className="wireframe-system-action" to="/local-databases/new">
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
      count={5}
      countLabel={{ singular: "tool", plural: "tools" }}
    >
      <section className="wireframe-system-card-grid" aria-label="Application tools">
        <Link className="wireframe-system-card" to="/local-databases">
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
        <Link className="wireframe-system-card" to="/local-databases/new">
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
        <Link className="wireframe-system-card" to="/schema-builder">
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
        <Link className="wireframe-system-card" to="/live-database">
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
        <Link className="wireframe-system-card" to="/import">
          <span className="wireframe-system-card-icon">
            <FileSpreadsheet size={20} aria-hidden="true" />
          </span>
          <span className="wireframe-system-card-copy">
            <strong>Import data</strong>
            <small>Import records from a CSV file</small>
          </span>
          <span className="wireframe-system-card-arrow" aria-hidden="true">
            ↗
          </span>
        </Link>
      </section>
    </WireframeSystemPage>
  );
}

export function WireframeImportPage() {
  return (
    <WireframeSystemPage
      title="Import data"
      description="Import records from a CSV file into a collection."
      count={0}
      showCount={false}
      activeCollection=""
    >
      <div className="import-card wireframe-system-card" style={{ flexDirection: "column", alignItems: "flex-start", gap: "0.75rem", padding: "1.5rem" }}>
        <div className="wireframe-system-card-icon" style={{ width: "3rem", height: "3rem" }}>
          <FileSpreadsheet size={22} aria-hidden="true" />
        </div>
        <div>
          <strong style={{ display: "block", marginBottom: "0.3rem" }}>CSV import</strong>
          <p className="upload-placeholder" style={{ margin: 0, fontSize: "0.8125rem" }}>
            CSV import is coming soon. You'll be able to map columns to collection fields and preview records before import.
          </p>
        </div>
      </div>
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
