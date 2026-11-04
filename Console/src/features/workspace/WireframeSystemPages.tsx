import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Database, GraduationCap, MapPin, BriefcaseBusiness, Gem, ReceiptText, Wrench } from "lucide-react";
import { QueryFeedback } from "../../components/QueryFeedback";
import { useLocalDatabasesQuery } from "../../data/workflowQueries";
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

function WireframeSystemPage({
  children,
  title,
  description,
  count,
}: {
  children: ReactNode;
  title: string;
  description: string;
  count: number;
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
          activeCollection=""
          collapsed={mobileOpen ? false : collapsed}
          onToggleCollapsed={() => setCollapsed((value) => !value)}
          onCloseNavigation={navigation ? navigation.close : undefined}
          mobileDrawerOpen={mobileOpen}
        />
      </div>
      <WireframePageView title={title} description={description} recordCount={count}>
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
  const education = useEducationQuery(true);
  const employment = useEmploymentQuery(true);
  const addresses = useAddressesQuery(true);
  const transactions = useTransactionsQuery(true);
  const hues = useGemHuesQuery(true);
  const services = useServiceAccountsQuery(true);
  const recordCounts = {
    Education: education.data?.length,
    Employment: employment.data?.length,
    Addresses: addresses.data?.length,
    "Expense Tracker": transactions.data?.length,
    "Gem Hues": hues.data?.length,
    Services: services.data?.length,
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
    >
      <div className="wireframe-system-page-actions">
        <Link className="wireframe-system-action" to="/local-databases">
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
