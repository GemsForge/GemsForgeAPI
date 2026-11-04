import { lazy, Suspense, Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";
import type { UseQueryResult } from "@tanstack/react-query";
import { useDomainsQuery } from "../data/domainQueries";
import {
  useAddressesQuery,
  useEducationQuery,
  useEmploymentQuery,
  useGemHuesQuery,
  useTransactionsQuery,
  useServiceAccountsQuery,
} from "../data/lifeQueries";
import { usePagesQuery, usePageMutation, type PageScope } from "../data/workflowQueries";
import { QueryFeedback } from "../components/QueryFeedback";
import { Notice } from "../components/Notice";
import { GemLifeShell } from "../components/layout/GemLifeShell";
import { DomainSidebar } from "../features/domains/DomainSidebar";
import { useCreateDomainMutation } from "../data/domainQueries";
import { DomainCreateForm } from "../features/create/RecordCreateForms";
import { LocalSession } from "../components/LocalSession";
import { RequireAuth } from "../auth/RequireAuth";
import { SignInPage } from "../auth/SignInPage";
import { isRecoveryLink, ResetPasswordPage } from "../auth/ResetPasswordPage";
import { WireframeAppHeader, WireframeNavigationProvider } from "../features/workspace/WireframeAppHeader";
const ForgeKeeperView = lazy(() =>
  import("../features/forgekeeper/ForgeKeeperView").then((module) => ({ default: module.ForgeKeeperView })),
);
const GemHuesView = lazy(() =>
  import("../features/gem-hues/GemHuesView").then((module) => ({ default: module.GemHuesView })),
);
const EducationView = lazy(() =>
  import("../features/education/EducationView").then((module) => ({ default: module.EducationView })),
);
const EducationWireframeView = lazy(() =>
  import("../features/education/EducationWireframeView").then((module) => ({ default: module.EducationWireframeView })),
);
const EmploymentWireframeView = lazy(() =>
  import("../features/employment/EmploymentWireframeView").then((module) => ({
    default: module.EmploymentWireframeView,
  })),
);
const AddressesWireframeView = lazy(() =>
  import("../features/addresses/AddressesWireframeView").then((module) => ({ default: module.AddressesWireframeView })),
);
const TransactionsWireframeView = lazy(() =>
  import("../features/transactions/TransactionsWireframeView").then((module) => ({
    default: module.TransactionsWireframeView,
  })),
);
const GemHuesWireframeView = lazy(() =>
  import("../features/gem-hues/GemHuesWireframeView").then((module) => ({ default: module.GemHuesWireframeView })),
);
const ServiceCatalogWireframeView = lazy(() =>
  import("../features/service-accounts/ServiceCatalogWireframeView").then((module) => ({
    default: module.ServiceCatalogWireframeView,
  })),
);
const EmploymentView = lazy(() =>
  import("../features/employment/EmploymentView").then((module) => ({ default: module.EmploymentView })),
);
const AddressesView = lazy(() =>
  import("../features/addresses/AddressesView").then((module) => ({ default: module.AddressesView })),
);
const TransactionsView = lazy(() =>
  import("../features/transactions/TransactionsView").then((module) => ({ default: module.TransactionsView })),
);
const ServiceAccountsView = lazy(() =>
  import("../features/service-accounts/ServiceAccountsView").then((module) => ({
    default: module.ServiceAccountsView,
  })),
);
const LocalDatabaseView = lazy(() =>
  import("../features/databases/LocalDatabaseView").then((module) => ({ default: module.LocalDatabaseView })),
);
const SchemaBuilderView = lazy(() =>
  import("../features/schema/SchemaBuilderView").then((module) => ({ default: module.SchemaBuilderView })),
);
const SchemaTablePage = lazy(() =>
  import("../features/schema/SchemaTablePage").then((module) => ({ default: module.SchemaTablePage })),
);
const LiveDatabaseMigrationView = lazy(() =>
  import("../features/schema/LiveDatabaseMigrationView").then((module) => ({
    default: module.LiveDatabaseMigrationView,
  })),
);
const WorkspaceView = lazy(() =>
  import("../features/workspace/WorkspaceView").then((module) => ({ default: module.WorkspaceView })),
);
const WireframeDemoView = lazy(() =>
  import("../features/workspace/WireframeDemoView").then((module) => ({ default: module.WireframeDemoView })),
);
const WireframeHomePage = lazy(() =>
  import("../features/workspace/WireframeSystemPages").then((module) => ({ default: module.WireframeHomePage })),
);
const WireframeDatabasesPage = lazy(() =>
  import("../features/workspace/WireframeSystemPages").then((module) => ({ default: module.WireframeDatabasesPage })),
);
const WireframeSettingsPage = lazy(() =>
  import("../features/workspace/WireframeSystemPages").then((module) => ({ default: module.WireframeSettingsPage })),
);
const WireframeTrashPage = lazy(() =>
  import("../features/workspace/WireframeSystemPages").then((module) => ({ default: module.WireframeTrashPage })),
);
const WireframeDomainsPage = lazy(() =>
  import("../features/workspace/WireframeMvpWorkflowPages").then((module) => ({
    default: module.WireframeDomainsPage,
  })),
);
const WireframeForgeKeeperPage = lazy(() =>
  import("../features/workspace/WireframeMvpWorkflowPages").then((module) => ({
    default: module.WireframeForgeKeeperPage,
  })),
);
const WireframeLocalDatabaseCreationPage = lazy(() =>
  import("../features/workspace/WireframeMvpWorkflowPages").then((module) => ({
    default: module.WireframeLocalDatabaseCreationPage,
  })),
);
const WireframeSchemaBuilderPage = lazy(() =>
  import("../features/workspace/WireframeMvpWorkflowPages").then((module) => ({
    default: module.WireframeSchemaBuilderPage,
  })),
);
const WireframeLiveDatabasePage = lazy(() =>
  import("../features/workspace/WireframeMvpWorkflowPages").then((module) => ({
    default: module.WireframeLiveDatabasePage,
  })),
);

type Notifications = { onError: (error: unknown) => void; onSuccess: (message: string) => void };

export class ScreenBoundary extends Component<
  { children: ReactNode },
  { failed: boolean; errorMessage: string | null }
> {
  state = { failed: false, errorMessage: null as string | null };
  static getDerivedStateFromError(error: unknown) {
    return { failed: true, errorMessage: error instanceof Error ? error.message : String(error) };
  }
  render() {
    return this.state.failed ? (
      <section role="alert">
        <h2>This screen could not be displayed</h2>
        <p>Return home or reload the app if its version changed.</p>
        {import.meta.env.DEV && this.state.errorMessage && (
          <pre className="screen-error-details">{this.state.errorMessage}</pre>
        )}
        <div className="button-row">
          <Link to="/">Return home</Link>
          <button className="secondary-button" onClick={() => window.location.reload()}>
            Reload app
          </button>
        </div>
      </section>
    ) : (
      this.props.children
    );
  }
}

function Layout() {
  const domains = useDomainsQuery();
  const location = useLocation();
  const [notice, setNotice] = useState<{ message: string; kind: "error" | "success" } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onError = useCallback((error: unknown) => {
    clearTimeout(timer.current);
    setNotice({ message: error instanceof Error ? error.message : "Request failed.", kind: "error" });
  }, []);
  const onSuccess = useCallback((message: string) => {
    clearTimeout(timer.current);
    setNotice({ message, kind: "success" });
    timer.current = setTimeout(() => setNotice(null), 3500);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    setNotice(null);
    document.title = "Gem Life · " + (location.pathname === "/" ? "Home" : location.pathname.split("/")[1]);
    document.getElementById("main-content")?.focus();
  }, [location.pathname]);
  return (
    <GemLifeShell sidebar={<DomainSidebar domains={domains.data ?? []} onRefresh={() => void domains.refetch()} />}>
      <Notice message={notice?.message ?? null} kind={notice?.kind} />
      <ScreenBoundary key={location.pathname}>
        <Suspense fallback={<p role="status">Loading screen…</p>}>
          <Outlet context={{ onError, onSuccess } satisfies Notifications} />
        </Suspense>
      </ScreenBoundary>
    </GemLifeShell>
  );
}

function WireframeCanvas() {
  const location = useLocation();
  useEffect(() => {
    document.title = "Gem Life · " + (location.pathname.split("/")[1] || "Wireframe");
    document.getElementById("main-content")?.focus();
  }, [location.pathname]);

  return (
    <div className="wireframe-canvas">
      <WireframeNavigationProvider key={location.pathname}>
        <WireframeAppHeader />
        <main className="wireframe-canvas-content" id="main-content" tabIndex={-1} aria-label="Wireframe screen">
          <ScreenBoundary key={location.pathname}>
            <Suspense fallback={<p role="status">Loading wireframe…</p>}>
              <Outlet />
            </Suspense>
          </ScreenBoundary>
        </main>
      </WireframeNavigationProvider>
    </div>
  );
}

function QueryScreen<T>({ query, children }: { query: UseQueryResult<T, Error>; children: (data: T) => ReactNode }) {
  return (
    <>
      <QueryFeedback query={query} />
      {query.data !== undefined && children(query.data)}
    </>
  );
}

function Home() {
  return <Workspace />;
}
function Domains() {
  const query = useDomainsQuery();
  const create = useCreateDomainMutation();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <div className="content-heading">
        <h2>Domains</h2>
        <button type="button" onClick={() => setCreating(true)}>
          Add domain
        </button>
      </div>
      {creating && (
        <DomainCreateForm
          onCancel={() => setCreating(false)}
          onCreate={async (payload) => {
            await create.mutateAsync(payload);
            setCreating(false);
          }}
        />
      )}
      <QueryScreen query={query}>
        {(domains) => (
          <div className="page-list">
            {!domains.length && <p>No domains yet.</p>}
            {domains.map((domain) => (
              <Link className="page-card" to={`/domains/${encodeURIComponent(domain.id)}`} key={domain.id}>
                <h3>{domain.title}</h3>
                <p>{domain.description}</p>
              </Link>
            ))}
          </div>
        )}
      </QueryScreen>
    </>
  );
}
function Pages({ kind }: { kind: PageScope["kind"] }) {
  const { domainID, pageID } = useParams();
  const domains = useDomainsQuery();
  const navigate = useNavigate();
  const { onSuccess } = useOutletContext<Notifications>();
  const validPageID =
    pageID !== undefined && /^\d+$/.test(pageID) && Number.isSafeInteger(Number(pageID)) && Number(pageID) > 0;
  const domain = domains.data?.find((item) => item.id === domainID) ?? null;
  const scope: PageScope =
    kind === "domain" ? { kind, id: domainID! } : kind === "children" ? { kind, id: Number(pageID) } : { kind };
  const query = usePagesQuery(scope, kind === "roots" || (kind === "children" ? validPageID : domain !== null));
  const mutation = usePageMutation();
  if (kind === "children" && !validPageID) return <NotFound />;
  if (kind === "domain" && !domain) return domains.data ? <NotFound /> : <QueryFeedback query={domains} />;
  return (
    <QueryScreen query={query}>
      {(pages) => (
        <ForgeKeeperView
          domain={domain}
          pages={pages}
          onLoadRoots={() => navigate("/forgekeeper")}
          onLoadChildren={(id) => navigate(`/forgekeeper/${id}/children`)}
          onPatch={async (id, patch) => {
            await mutation.mutateAsync({ id, patch });
            onSuccess("Page metadata updated.");
          }}
        />
      )}
    </QueryScreen>
  );
}
function Hues() {
  const query = useGemHuesQuery(true);
  return <QueryScreen query={query}>{(hues) => <GemHuesView hues={hues} />}</QueryScreen>;
}
function Education() {
  const query = useEducationQuery(true);
  return <QueryScreen query={query}>{(records) => <EducationView records={records} />}</QueryScreen>;
}
function EducationWireframe() {
  const query = useEducationQuery(true);
  return <QueryScreen query={query}>{(records) => <EducationWireframeView records={records} />}</QueryScreen>;
}
function EmploymentWireframe() {
  const query = useEmploymentQuery(true);
  return <QueryScreen query={query}>{(records) => <EmploymentWireframeView records={records} />}</QueryScreen>;
}
function AddressesWireframe() {
  const query = useAddressesQuery(true);
  return <QueryScreen query={query}>{(records) => <AddressesWireframeView records={records} />}</QueryScreen>;
}
function TransactionsWireframe() {
  const query = useTransactionsQuery(true);
  return <QueryScreen query={query}>{(records) => <TransactionsWireframeView records={records} />}</QueryScreen>;
}
function GemHuesWireframe() {
  const query = useGemHuesQuery(true);
  return <QueryScreen query={query}>{(records) => <GemHuesWireframeView records={records} />}</QueryScreen>;
}
function ServiceCatalogWireframe() {
  const query = useServiceAccountsQuery(true);
  return <QueryScreen query={query}>{(records) => <ServiceCatalogWireframeView records={records} />}</QueryScreen>;
}
function Employment() {
  const query = useEmploymentQuery(true);
  return <QueryScreen query={query}>{(records) => <EmploymentView records={records} />}</QueryScreen>;
}
function Addresses() {
  const query = useAddressesQuery(true);
  return <QueryScreen query={query}>{(records) => <AddressesView records={records} />}</QueryScreen>;
}
function Transactions() {
  const query = useTransactionsQuery(true);
  return <QueryScreen query={query}>{(records) => <TransactionsView records={records} />}</QueryScreen>;
}
function ServiceAccounts() {
  const query = useServiceAccountsQuery(true);
  return <QueryScreen query={query}>{(records) => <ServiceAccountsView records={records} />}</QueryScreen>;
}
function Databases() {
  return <LocalDatabaseView {...useOutletContext<Notifications>()} />;
}
function Workspace() {
  return <WorkspaceView onSuccess={useOutletContext<Notifications>().onSuccess} />;
}
function WireframeDemo() {
  return <WireframeDemoView />;
}
function Schema() {
  return <SchemaBuilderView {...useOutletContext<Notifications>()} />;
}
function LiveDatabase() {
  return <LiveDatabaseMigrationView {...useOutletContext<Notifications>()} />;
}
function NotFound() {
  return (
    <section>
      <h2>Page not found</h2>
      <p>This Gem Life route or record does not exist.</p>
      <Link to="/">Return home</Link>
    </section>
  );
}

/** Explicit routes ensure direct links, Back/Forward, and unknown paths agree. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="login" element={isRecoveryLink() ? <ResetPasswordPage /> : <SignInPage />} />
      <Route path="reset-password" element={<ResetPasswordPage />} />
      <Route path="/" element={isRecoveryLink() ? <ResetPasswordPage /> : <Navigate to="/login" replace />} />
      <Route element={<RequireAuth />}>
        <Route
          element={
            <LocalSession>
              <WireframeCanvas />
            </LocalSession>
          }
        >
          <Route path="home-wireframe" element={<WireframeHomePage />} />
          <Route path="local-databases-wireframe" element={<WireframeDatabasesPage />} />
          <Route path="application-settings-wireframe" element={<WireframeSettingsPage />} />
          <Route path="trash-wireframe" element={<WireframeTrashPage />} />
          <Route path="domains-wireframe" element={<WireframeDomainsPage />} />
          <Route path="forgekeeper-wireframe" element={<WireframeForgeKeeperPage kind="roots" />} />
          <Route path="forgekeeper-wireframe/domain/:domainID" element={<WireframeForgeKeeperPage kind="domain" />} />
          <Route path="forgekeeper-wireframe/:pageID/children" element={<WireframeForgeKeeperPage kind="children" />} />
          <Route path="local-database-wireframe" element={<WireframeLocalDatabaseCreationPage />} />
          <Route path="schema-builder-wireframe" element={<WireframeSchemaBuilderPage />} />
          <Route path="live-database-wireframe" element={<WireframeLiveDatabasePage />} />
          <Route path="education-wireframe/*" element={<EducationWireframe />} />
          <Route path="employment-wireframe/*" element={<EmploymentWireframe />} />
          <Route path="addresses-wireframe/*" element={<AddressesWireframe />} />
          <Route path="transactions-wireframe/*" element={<TransactionsWireframe />} />
          <Route path="gemhues-wireframe/*" element={<GemHuesWireframe />} />
          <Route path="service-catalog-wireframe/*" element={<ServiceCatalogWireframe />} />
        </Route>
        <Route
          element={
            <LocalSession>
              <Layout />
            </LocalSession>
          }
        >
          <Route index element={<Home />} />
          <Route path="domains" element={<Domains />} />
          <Route path="workspace" element={<Workspace />} />
          <Route path="wireframe-demo" element={<WireframeDemo />} />
          <Route path="domains/:domainID" element={<Pages kind="domain" />} />
          <Route path="forgekeeper" element={<Pages kind="roots" />} />
          <Route path="forgekeeper/:pageID/children" element={<Pages kind="children" />} />
          <Route path="gemhues" element={<Hues />} />
          <Route path="education" element={<Education />} />
          <Route path="employment" element={<Employment />} />
          <Route path="addresses" element={<Addresses />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="service-accounts" element={<ServiceAccounts />} />
          <Route path="expenses" element={<Navigate to="/transactions" replace />} />
          <Route path="local-databases" element={<Databases />} />
          <Route path="schema-builder" element={<Schema />} />
          <Route path="schema/:tableName" element={<SchemaTablePage />} />
          <Route path="live-database" element={<LiveDatabase />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}
