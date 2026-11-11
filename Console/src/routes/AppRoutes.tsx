import { lazy, Suspense, Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation, useOutletContext, useParams } from "react-router-dom";
import type { UseQueryResult } from "@tanstack/react-query";
import { Theme } from "tamagui";
import {
  useAddressesQuery,
  useEducationQuery,
  useEmploymentQuery,
  useGemHuesQuery,
  useTransactionsQuery,
  useServiceAccountsQuery,
} from "../data/lifeQueries";
import { QueryFeedback } from "../components/QueryFeedback";
import { Notice } from "../components/Notice";
import { LocalSession } from "../components/LocalSession";
import { RequireAuth } from "../auth/RequireAuth";
import { SignInPage } from "../auth/SignInPage";
import { WireframeAppHeader, WireframeNavigationProvider } from "../features/workspace/WireframeAppHeader";
import { AppShell, useAppShell } from "../features/workspace/AppShell";
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
const WireframeSchemaPage = lazy(() =>
  import("../features/schema/WireframeSchemaPage").then((module) => ({ default: module.WireframeSchemaPage })),
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

type ShellNotifications = Notifications & { notice: { message: string; kind: "error" | "success" } | null };

function WireframeCanvas() {
  const location = useLocation();
  const [notice, setNotice] = useState<ShellNotifications["notice"]>(null);
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
    document.title = "Gem Life · " + (location.pathname.split("/")[1] || "Home");
    document.getElementById("main-content")?.focus();
  }, [location.pathname]);

  // The signed-in canvas is a light surface; Tamagui components inside it must
  // resolve the light theme rather than the app's dark default.
  return (
    <Theme name="light">
      <div className="wireframe-canvas">
        <WireframeNavigationProvider>
          <WireframeAppHeader />
          <main className="wireframe-canvas-content" id="main-content" tabIndex={-1} aria-label="Gem Life screen">
            <AppShell>
              <ScreenBoundary key={location.pathname}>
                <Suspense fallback={<p role="status">Loading screen…</p>}>
                  <Outlet context={{ onError, onSuccess, notice } satisfies ShellNotifications} />
                </Suspense>
              </ScreenBoundary>
            </AppShell>
          </main>
        </WireframeNavigationProvider>
      </div>
    </Theme>
  );
}

/** Content column for screens that do not render their own MVP2 page view. */
function ShellPage({ children }: { children: ReactNode }) {
  const { notice } = useOutletContext<ShellNotifications>();
  useAppShell({ recordCount: 0 });
  return (
    <section className="wireframe-demo-main wireframe-shell-page">
      <Notice message={notice?.message ?? null} kind={notice?.kind} />
      {children}
    </section>
  );
}

/** Retired `*-wireframe` URLs keep working by redirecting to their canonical route. */
const retiredWireframeRoutes = [
  ["home-wireframe", ""],
  ["domains-wireframe", "/domains"],
  ["forgekeeper-wireframe", "/forgekeeper"],
  ["education-wireframe", "/education"],
  ["employment-wireframe", "/employment"],
  ["addresses-wireframe", "/addresses"],
  ["transactions-wireframe", "/transactions"],
  ["gemhues-wireframe", "/gemhues"],
  ["service-catalog-wireframe", "/service-accounts"],
  ["local-databases-wireframe", "/local-databases"],
  ["local-database-wireframe", "/local-databases/new"],
  ["schema-builder-wireframe", "/schema-builder"],
  ["schema-wireframe", "/schema"],
  ["live-database-wireframe", "/live-database"],
  ["trash-wireframe", "/trash"],
  ["application-settings-wireframe", "/application-settings"],
] as const;

function RetiredWireframeRedirect({ from, to }: { from: string; to: string }) {
  const location = useLocation();
  const rest = location.pathname.slice(from.length + 1);
  return <Navigate replace to={{ pathname: `${to}${rest}` || "/", search: location.search, hash: location.hash }} />;
}

function DomainPagesRedirect() {
  const { domainID = "" } = useParams();
  return <Navigate replace to={`/forgekeeper/domain/${encodeURIComponent(domainID)}`} />;
}

function QueryScreen<T>({ query, children }: { query: UseQueryResult<T, Error>; children: (data: T) => ReactNode }) {
  return (
    <>
      <QueryFeedback query={query} />
      {query.data !== undefined && children(query.data)}
    </>
  );
}

/** Collection routes accept the collection root and `record/:id`; anything else is not found. */
function CollectionRoute({ children }: { children: ReactNode }) {
  const { "*": rest = "" } = useParams();
  if (rest && !/^record\/[^/]+$/.test(rest)) {
    return (
      <ShellPage>
        <NotFound />
      </ShellPage>
    );
  }
  return children;
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
function Workspace() {
  return (
    <ShellPage>
      <WorkspaceView onSuccess={useOutletContext<ShellNotifications>().onSuccess} />
    </ShellPage>
  );
}
function WireframeDemo() {
  return <WireframeDemoView />;
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

/** Sign-in and recovery share the signed-in canvas's light theme so auth fields and errors resolve light values. */
function AuthLayout() {
  return (
    <Theme name="light">
      <Outlet />
    </Theme>
  );
}

/** Explicit routes ensure direct links, Back/Forward, and unknown paths agree. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="login" element={<SignInPage />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route
          element={
            <LocalSession>
              <WireframeCanvas />
            </LocalSession>
          }
        >
          <Route index element={<WireframeHomePage />} />
          <Route path="wireframe-demo" element={<WireframeDemo />} />
          <Route path="workspace" element={<Workspace />} />
          <Route path="domains" element={<WireframeDomainsPage />} />
          <Route path="domains/:domainID" element={<DomainPagesRedirect />} />
          <Route path="forgekeeper" element={<WireframeForgeKeeperPage kind="roots" />} />
          <Route path="forgekeeper/domain/:domainID" element={<WireframeForgeKeeperPage kind="domain" />} />
          <Route path="forgekeeper/:pageID/children" element={<WireframeForgeKeeperPage kind="children" />} />
          <Route
            path="education/*"
            element={
              <CollectionRoute>
                <EducationWireframe />
              </CollectionRoute>
            }
          />
          <Route
            path="employment/*"
            element={
              <CollectionRoute>
                <EmploymentWireframe />
              </CollectionRoute>
            }
          />
          <Route
            path="addresses/*"
            element={
              <CollectionRoute>
                <AddressesWireframe />
              </CollectionRoute>
            }
          />
          <Route
            path="transactions/*"
            element={
              <CollectionRoute>
                <TransactionsWireframe />
              </CollectionRoute>
            }
          />
          <Route path="expenses" element={<Navigate to="/transactions" replace />} />
          <Route
            path="gemhues/*"
            element={
              <CollectionRoute>
                <GemHuesWireframe />
              </CollectionRoute>
            }
          />
          <Route
            path="service-accounts/*"
            element={
              <CollectionRoute>
                <ServiceCatalogWireframe />
              </CollectionRoute>
            }
          />
          <Route path="local-databases" element={<WireframeDatabasesPage />} />
          <Route path="local-databases/new" element={<WireframeLocalDatabaseCreationPage />} />
          <Route path="schema-builder" element={<WireframeSchemaBuilderPage />} />
          <Route path="schema/:tableName/*" element={<WireframeSchemaPage />} />
          <Route path="live-database" element={<WireframeLiveDatabasePage />} />
          <Route path="trash" element={<WireframeTrashPage />} />
          <Route path="application-settings" element={<WireframeSettingsPage />} />
          {retiredWireframeRoutes.map(([from, to]) => (
            <Route path={`${from}/*`} element={<RetiredWireframeRedirect from={from} to={to} />} key={from} />
          ))}
          <Route
            path="*"
            element={
              <ShellPage>
                <NotFound />
              </ShellPage>
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}
