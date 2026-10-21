// Development-only visual fixture; not an entry in the production Vite build.
// No personal data and no network/database writes are used by this page.
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TamaguiProvider } from "tamagui";
import { tamaguiConfig } from "../design-system";
import { GemLifeShell } from "../components/layout/GemLifeShell";
import { DomainSidebar } from "../features/domains/DomainSidebar";
import { SchemaBuilderView } from "../features/schema/SchemaBuilderView";
import { ForgeKeeperView } from "../features/forgekeeper/ForgeKeeperView";
import { GemDataTable } from "../components/ui/GemDataTable";
import { GemRecordList } from "../components/ui/GemRecordList";
import { GemRecordCard } from "../components/ui/GemRecordCard";
import { FilePresentation } from "../components/FilePresentation";
import { AuthProvider } from "../auth/AuthProvider";
import "../styles.css";

window.fetch = async (input, init) => {
  const url = String(input);
  if (init?.method && init.method !== "GET")
    return new Response(JSON.stringify({ reason: "Fixture writes are disabled." }), { status: 405 });
  if (url.endsWith("/content"))
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#78d1bd"/></svg>',
      { headers: { "Content-Type": "image/svg+xml" } },
    );
  const data = url.includes("file-metadata")
    ? {
        id: "fixture",
        fileName: "a-long-example-image-name-for-responsive-preview.svg",
        relativePath: "fixture.svg",
        mimeType: "image/svg+xml",
        byteSize: 160,
        fileKind: "image",
      }
    : url.includes("schema-builder")
      ? { version: 1, supportedTypes: [{ value: "TEXT", label: "Text", description: "Text values" }], rules: [] }
      : {
          databaseName: "Fixture.sqlite",
          tableCount: 1,
          tables: [
            {
              name: "LongExampleTableNameForNarrowScreens",
              columns: [{ name: "ExampleProperty", dataType: "TEXT", primaryKey: false, nullable: true }],
              foreignKeys: [],
              indexes: [],
            },
          ],
        };
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
};
const domains = [{ id: "TEST", title: "Long example domain title", description: "Synthetic records only" }];
createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <QueryClientProvider client={new QueryClient()}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <MemoryRouter>
          <GemLifeShell sidebar={<DomainSidebar domains={domains} onRefresh={() => {}} />}>
            <h2>Responsive fixture</h2>
            <p>Local synthetic content. Writes are disabled.</p>
            <GemDataTable
              caption="Wide table fixture"
              columns={[{ key: "value", label: "Long property", render: (row: { id: string }) => row.id }]}
              rows={Array.from({ length: 1000 }, (_, index) => ({
                id: `Record ${index}: example long identifier for wrapping and horizontal table scrolling`,
              }))}
              rowKey={(row) => row.id}
            />
            <GemRecordList
              label="Responsive gallery fixture"
              records={Array.from({ length: 6 }, (_, index) => ({
                id: `fixture-${index + 1}`,
                title: `Long synthetic record title ${index + 1} for compact gallery wrapping`,
                category: "Fixture category",
              }))}
              getKey={(record) => record.id}
              renderRecord={(record) => (
                <GemRecordCard
                  className="fixture-card"
                  icon="◎"
                  title={record.title}
                  subtitle={`${record.category} · ${record.id}`}
                  properties={[{ label: "Category", value: record.category }]}
                  onSelect={() => {}}
                />
              )}
              tableColumns={[
                { key: "title", label: "Entry", icon: () => "◎", render: (record) => record.title },
                { key: "category", label: "Category", render: (record) => record.category },
                { key: "id", label: "Item ID", render: (record) => record.id },
              ]}
            />
            <FilePresentation fileMetadataID="fixture" label="Fixture image" />
            <ForgeKeeperView
              domain={domains[0]}
              pages={[
                {
                  id: 1,
                  domainID: "TEST",
                  title: "Fixture page",
                  description: "Test the dialog without saving",
                  parentID: null,
                },
              ]}
              onLoadRoots={() => {}}
              onLoadChildren={() => {}}
              onPatch={async () => {
                throw new Error("Fixture writes are disabled.");
              }}
            />
            <SchemaBuilderView onError={() => {}} onSuccess={() => {}} />
          </GemLifeShell>
        </MemoryRouter>
      </TamaguiProvider>
    </QueryClientProvider>
  </AuthProvider>,
);
