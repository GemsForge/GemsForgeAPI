import { useNotionImportPreviewQuery } from "../../data/notionImportQueries";

export function NotionImportPreviewView() {
  const preview = useNotionImportPreviewQuery();
  const resources = preview.data?.resources ?? [];
  const databases = resources.filter((resource) => resource.notionObject === "data_source");
  const pages = resources.filter((resource) => resource.notionObject === "page");

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
            {pages.length === 1 ? "page" : "pages"}, and {preview.data.totalRows} proposed items found.
          </p>
          <p className="notion-import-note">
            This is a read-only mapping preview. No GemLife records have been created from it.
          </p>
          {preview.data.unmappedProperties.length > 0 ? (
            <div className="notion-import-message" role="status">
              <strong>{preview.data.unmappedProperties.length} mapping items need review</strong>
              <ul>
                {preview.data.unmappedProperties.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <h4>Databases</h4>
          {databases.length === 0 ? (
            <p>No databases are shared with this Notion integration.</p>
          ) : (
            <div className="notion-import-resource-list">
              {databases.map((resource) => (
                <details className="notion-import-resource" key={resource.notionID}>
                  <summary>
                    <strong>{resource.title}</strong>
                    <span>
                      {resource.rowCount} {resource.rowCount === 1 ? "row" : "rows"} → {resource.target}
                    </span>
                    {resource.unmappedProperties.length > 0 ? <em>Review needed</em> : null}
                  </summary>
                  {resource.properties.length > 0 ? (
                    <div className="notion-import-property-scroll">
                      <table>
                        <caption>Property mapping for {resource.title}</caption>
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
                  <strong>{resource.title}</strong>
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
