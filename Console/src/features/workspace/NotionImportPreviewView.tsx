import type { NotionImportPreview } from "../../api";
import { useNotionImportPreviewQuery } from "../../data/notionImportQueries";

const unavailableSourcePrefix = "Not imported:";

export function reviewReportRows(preview: NotionImportPreview): string[] {
  const cells = (values: Array<string | number>) =>
    values
      .map((value) => {
        const text = String(value);
        const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
        return `"${safe.replaceAll('"', '""')}"`;
      })
      .join(",");
  const rows = [
    cells(["Notion ID", "Resource", "Kind", "GemLife target", "Rows", "Property", "Notion type", "Proposed storage"]),
  ];
  for (const resource of preview.resources) {
    if (resource.target === "Review required") {
      rows.push(
        cells([
          resource.notionID,
          resource.title,
          resource.notionObject,
          resource.target,
          resource.rowCount,
          "Target",
          "",
          "Choose a GemLife destination",
        ]),
      );
    }
    if (resource.target.startsWith(unavailableSourcePrefix)) {
      rows.push(
        cells([
          resource.notionID,
          resource.title,
          resource.notionObject,
          resource.target,
          resource.rowCount,
          "Data source access",
          "",
          "Share the data source with the Notion integration, then reload the preview",
        ]),
      );
    }
    for (const property of resource.properties.filter((item) => item.requiresReview)) {
      rows.push(
        cells([
          resource.notionID,
          resource.title,
          resource.notionObject,
          resource.target,
          resource.rowCount,
          property.name,
          property.notionType,
          property.proposedStorage,
        ]),
      );
    }
  }
  return rows;
}

function downloadReviewReport(preview: NotionImportPreview) {
  const rows = reviewReportRows(preview);
  const url = URL.createObjectURL(new Blob([`\uFEFF${rows.join("\r\n")}\r\n`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "notion-import-review.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function NotionImportPreviewView() {
  const preview = useNotionImportPreviewQuery();
  const resources = preview.data?.resources ?? [];
  const dataSources = resources.filter((resource) => resource.notionObject === "data_source");
  const unavailableDataSources = dataSources.filter((resource) => resource.target.startsWith(unavailableSourcePrefix));
  const databases = dataSources.filter((resource) => !resource.target.startsWith(unavailableSourcePrefix));
  const pages = resources.filter((resource) => resource.notionObject === "page");
  const titleCounts = new Map<string, number>();
  for (const resource of resources) {
    titleCounts.set(resource.title, (titleCounts.get(resource.title) ?? 0) + 1);
  }
  const displayTitle = (resource: (typeof resources)[number]) =>
    (titleCounts.get(resource.title) ?? 0) > 1 ? `${resource.title} (…${resource.notionID.slice(-6)})` : resource.title;
  const matchingItemCounts = new Map<string, number>();
  const reviewItems = (preview.data?.unmappedProperties ?? [])
    .filter((item) => {
      const candidates = resources.filter((resource) => item.startsWith(`${resource.title}: `));
      return !(
        item.endsWith(": database target") && candidates.some((resource) => resource.target.startsWith("New table: "))
      );
    })
    .map((item) => {
      const candidates = resources.filter((resource) => item.startsWith(`${resource.title}: `));
      const occurrence = matchingItemCounts.get(item) ?? 0;
      matchingItemCounts.set(item, occurrence + 1);
      const resource = candidates[occurrence] ?? candidates[0];
      return {
        key: resource ? `${resource.notionID}-${item}` : item,
        label: resource ? `${displayTitle(resource)}:${item.slice(resource.title.length + 1)}` : item,
      };
    });

  return (
    <section className="notion-import-preview" aria-labelledby="notion-import-heading">
      <div className="notion-import-intro">
        <div>
          <p className="eyebrow">Notion workspace</p>
          <h3 id="notion-import-heading">Review your Notion content</h3>
          <p>
            See what the GemLife importer can access and where each database would go. Loading this preview does not
            import anything.
          </p>
        </div>
        <button
          type="button"
          className="wireframe-system-action"
          disabled={preview.isFetching}
          onClick={() => void preview.refetch()}
        >
          {preview.isFetching ? "Loading preview…" : preview.data ? "Refresh preview" : "Load Notion preview"}
        </button>
      </div>

      {preview.isFetching ? <p role="status">Reading the pages and databases shared with GemLife Workspace…</p> : null}
      {preview.isError ? (
        <div className="notion-import-message" role="alert">
          <strong>Could not load the Notion preview</strong>
          <p>{preview.error instanceof Error ? preview.error.message : "Check the API connection and try again."}</p>
        </div>
      ) : null}

      {preview.data ? (
        <div className="notion-import-results">
          <p role="status" className="notion-import-summary">
            {databases.length} {databases.length === 1 ? "database" : "databases"}, {pages.length}{" "}
            {pages.length === 1 ? "page" : "pages"}
            {unavailableDataSources.length > 0
              ? `, ${unavailableDataSources.length} unavailable ${unavailableDataSources.length === 1 ? "data source" : "data sources"}`
              : ""}
            , and {preview.data.totalRows} proposed items found.
          </p>
          <p className="notion-import-note">
            This is a read-only mapping preview. No GemLife records have been created from it. Relations can link one
            mapped record per row; Notion rollup calculations need separate review.
          </p>
          <button type="button" className="wireframe-system-action" onClick={() => downloadReviewReport(preview.data)}>
            Download review report (CSV)
          </button>
          {preview.data.unmappedProperties.length > 0 ? (
            <div className="notion-import-message" role="status">
              <strong>{preview.data.unmappedProperties.length} mapping items need review</strong>
              <ul>
                {reviewItems.map((item) => (
                  <li key={item.key}>{item.label}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <h4>Databases</h4>
          {dataSources.length === 0 ? (
            <p>No databases are shared with this Notion integration.</p>
          ) : (
            <div className="notion-import-resource-list">
              {dataSources.map((resource) => (
                <details className="notion-import-resource" key={resource.notionID}>
                  <summary>
                    <strong>{displayTitle(resource)}</strong>
                    <span>
                      {resource.rowCount} {resource.rowCount === 1 ? "row" : "rows"} → {resource.target}
                    </span>
                    {resource.unmappedProperties.length > 0 ? <em>Review needed</em> : null}
                  </summary>
                  {resource.properties.length > 0 ? (
                    <div className="notion-import-property-scroll">
                      <table>
                        <caption>Property mapping for {displayTitle(resource)}</caption>
                        <thead>
                          <tr>
                            <th scope="col">Notion property</th>
                            <th scope="col">Type</th>
                            <th scope="col">Proposed storage</th>
                            <th scope="col">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resource.properties.map((property) => (
                            <tr key={property.name}>
                              <th scope="row">{property.name}</th>
                              <td>{property.notionType}</td>
                              <td>{property.proposedStorage}</td>
                              <td>{property.requiresReview ? "Review needed" : "Mapped"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p>No properties were returned for this database.</p>
                  )}
                </details>
              ))}
            </div>
          )}

          <h4>Pages</h4>
          {pages.length === 0 ? (
            <p>No pages are shared with this Notion integration.</p>
          ) : (
            <ul className="notion-import-page-list">
              {pages.map((resource) => (
                <li key={resource.notionID}>
                  <strong>{displayTitle(resource)}</strong>
                  <span>→ {resource.target}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
