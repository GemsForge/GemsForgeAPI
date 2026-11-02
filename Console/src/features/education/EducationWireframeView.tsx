import { useMemo, useRef, useState } from "react";
import { GalleryHorizontal, List, Table2 } from "lucide-react";
import type { Education } from "../../types";
import { useEducationPatchMutation } from "../../data/recordQueries";
import { WireframeLeftPane } from "../workspace/WireframeLeftPane";
import { WireframePageView } from "../workspace/WireframePageView";
import { WireframePropertyEditor } from "../workspace/WireframePropertyEditor";
import { WireframeEditableValue } from "../workspace/WireframeEditableValue";

type ViewMode = "table" | "list" | "gallery";
const cardColors = ["#e8b17d", "#a8d2cf", "#9dc9e0", "#e8b3b7"];

export function EducationWireframeView({ records }: { records: readonly Education[] }) {
  const patch = useEducationPatchMutation();
  const [view, setView] = useState<ViewMode>("gallery");
  const [selectedID, setSelectedID] = useState<string | null>(records[0]?.id ?? null);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [sortDescending, setSortDescending] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const selectedCardRef = useRef<HTMLButtonElement | null>(null);
  const selected = records.find((record) => record.id === selectedID) ?? null;
  const educationTypeOptions = [...new Set(records.map((record) => record.educationType))];
  const educationStatusOptions = [...new Set(records.map((record) => record.status))];
  const filteredRecords = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const result = records.filter((record) =>
      [record.institutionName, record.educationType, record.status, record.id].some((value) =>
        value?.toLowerCase().includes(normalized),
      ),
    );
    return [...result].sort((a, b) =>
      sortDescending
        ? b.institutionName.localeCompare(a.institutionName)
        : a.institutionName.localeCompare(b.institutionName),
    );
  }, [query, records, sortDescending]);
  const selectRecord = (id: string) => {
    setSelectedID(id);
    setExpanded(false);
  };
  const closeInspector = () => {
    setSelectedID(null);
    setExpanded(false);
    requestAnimationFrame(() => selectedCardRef.current?.focus());
  };

  return (
    <section
      className={`wireframe-demo education-wireframe ${expanded ? "is-expanded" : ""}`}
      aria-labelledby="wireframe-page-title"
    >
      <button
        type="button"
        className="wireframe-mobile-nav-toggle"
        aria-expanded={mobileNavigationOpen}
        aria-controls="education-wireframe-navigation"
        onClick={() => setMobileNavigationOpen((open) => !open)}
      >
        ☰ <span>Navigation</span>
      </button>
      <div
        id="education-wireframe-navigation"
        className={mobileNavigationOpen ? "wireframe-mobile-nav is-open" : "wireframe-mobile-nav"}
      >
        <WireframeLeftPane recordCount={records.length} />
      </div>
      <WireframePageView
        title="Education"
        description="Education history, institutions, credentials, and related documents."
        recordCount={filteredRecords.length}
      >
        <div className="demo-toolbar">
          <div className="demo-view-tabs" role="tablist" aria-label="Education view mode">
            {(["table", "list", "gallery"] as const).map((mode) => (
              <button
                className={view === mode ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={view === mode}
                aria-label={`${mode[0].toUpperCase() + mode.slice(1)} view`}
                title={`${mode[0].toUpperCase() + mode.slice(1)} view`}
                onClick={() => setView(mode)}
                key={mode}
              >
                {mode === "table" ? <Table2 size={18} aria-hidden="true" /> : mode === "list" ? <List size={18} aria-hidden="true" /> : <GalleryHorizontal size={18} aria-hidden="true" />}
              </button>
            ))}
          </div>
          <label className="demo-collection-search">
            ⌕{" "}
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search education records"
              placeholder="Search this collection…"
            />
          </label>
          <button
            type="button"
            className="demo-filter"
            aria-label="Clear search"
            disabled={!query}
            onClick={() => setQuery("")}
          >
            ≡
          </button>
          <button
            type="button"
            className="demo-sort"
            aria-pressed={sortDescending}
            onClick={() => setSortDescending((descending) => !descending)}
          >
            ↕ Sort {sortDescending ? "Z–A" : "A–Z"}
          </button>
        </div>
        {filteredRecords.length === 0 ? (
          <div className="wireframe-empty-state" role="status">
            <strong>No education records found</strong>
            <p>Try a different search.</p>
            <button type="button" className="demo-secondary-button" onClick={() => setQuery("")}>
              Clear search
            </button>
          </div>
        ) : (
          <div className={`demo-results demo-${view}`} role="list" aria-label="Education records">
            {filteredRecords.map((record, index) => (
              <button
                ref={selectedID === record.id ? selectedCardRef : undefined}
                type="button"
                role="listitem"
                aria-pressed={selectedID === record.id}
                className={`demo-place-card ${selectedID === record.id ? "selected" : ""}`}
                onClick={() => selectRecord(record.id)}
                key={record.id}
              >
                <span
                  className="demo-place-image"
                  style={{ background: `linear-gradient(135deg, ${cardColors[index % cardColors.length]}, #527b82)` }}
                  aria-hidden="true"
                />
                <span className="demo-place-copy">
                  <strong>{record.institutionName}</strong>
                  <small>{record.educationType}</small>
                  <em>{record.status}</em>
                  <small className="demo-place-meta">
                    {record.startDate ?? "No start date"}　▤ {record.id}
                  </small>
                </span>
              </button>
            ))}
          </div>
        )}
      </WireframePageView>
      {selected ? (
        <aside className="wireframe-demo-inspector" aria-labelledby="education-inspector-title">
          <div className="demo-inspector-heading">
            <div>
              <p>{expanded ? "Record page" : "Record inspector"}</p>
              <h2 id="education-inspector-title">{selected.institutionName}</h2>
            </div>
            <div className="demo-inspector-actions">
              {expanded ? (
                <button
                  type="button"
                  aria-label="Back to collection"
                  title="Back to collection"
                  onClick={() => {
                    setExpanded(false);
                    requestAnimationFrame(() => selectedCardRef.current?.focus());
                  }}
                >
                  ←
                </button>
              ) : (
                <button
                  type="button"
                  aria-label="Open full page"
                  title="Open full page"
                  onClick={() => setExpanded(true)}
                >
                  ↗
                </button>
              )}
              <button type="button" aria-label="Close inspector" onClick={closeInspector}>
                ×
              </button>
            </div>
          </div>
          <div className="demo-cover" style={{ background: "linear-gradient(135deg, #e8b17d, #527b82)" }} />
          <button type="button" className="demo-secondary-button">
            ▧ Change cover
          </button>
          <dl>
            <div>
              <dt>Record ID</dt>
              <dd>{selected.id}</dd>
            </div>
            <div>
              <dt>
                <WireframePropertyEditor label="Institution" value={selected.institutionName} />
              </dt>
              <dd>
                <WireframeEditableValue
                  label="Institution"
                  value={selected.institutionName}
                  onCommit={(value) =>
                    patch.mutateAsync({ id: selected.id, patch: { institutionName: value } }).then(() => undefined)
                  }
                />
              </dd>
            </div>
            <div>
              <dt>
                <WireframePropertyEditor label="Type" value={selected.educationType} />
              </dt>
              <dd>
                <WireframeEditableValue
                  label="Type"
                  value={selected.educationType}
                  kind="select"
                  options={educationTypeOptions}
                  onCommit={(value) =>
                    patch.mutateAsync({ id: selected.id, patch: { educationType: value } }).then(() => undefined)
                  }
                />
              </dd>
            </div>
            <div>
              <dt>
                <WireframePropertyEditor label="Program" value={selected.program ?? "—"} />
              </dt>
              <dd>
                <WireframeEditableValue
                  label="Program"
                  value={selected.program ?? ""}
                  onCommit={(value) =>
                    patch.mutateAsync({ id: selected.id, patch: { program: value || null } }).then(() => undefined)
                  }
                />
              </dd>
            </div>
            <div>
              <dt>
                <WireframePropertyEditor label="Status" value={selected.status} />
              </dt>
              <dd>
                <WireframeEditableValue
                  label="Status"
                  value={selected.status}
                  kind="status"
                  options={educationStatusOptions}
                  onCommit={(value) =>
                    patch.mutateAsync({ id: selected.id, patch: { status: value } }).then(() => undefined)
                  }
                />
              </dd>
            </div>
            <div>
              <dt>
                <WireframePropertyEditor
                  label="Dates"
                  value={`${selected.startDate ?? "—"} → ${selected.endDate ?? "—"}`}
                />
              </dt>
              <dd className="wireframe-date-pair">
                <WireframeEditableValue
                  label="Start date"
                  value={selected.startDate ?? ""}
                  kind="date"
                  onCommit={(value) =>
                    patch.mutateAsync({ id: selected.id, patch: { startDate: value || null } }).then(() => undefined)
                  }
                />
                <span>→</span>
                <WireframeEditableValue
                  label="End date"
                  value={selected.endDate ?? ""}
                  kind="date"
                  onCommit={(value) =>
                    patch.mutateAsync({ id: selected.id, patch: { endDate: value || null } }).then(() => undefined)
                  }
                />
              </dd>
            </div>
            <div>
              <dt>
                <WireframePropertyEditor label="Notes" value={selected.notes ?? "No notes yet."} />
              </dt>
              <dd>
                <WireframeEditableValue
                  label="Notes"
                  value={selected.notes ?? ""}
                  kind="textarea"
                  onCommit={(value) =>
                    patch.mutateAsync({ id: selected.id, patch: { notes: value || null } }).then(() => undefined)
                  }
                />
              </dd>
            </div>
          </dl>
          <h4>
            Attachments{" "}
            <button type="button" aria-label="Add attachment">
              ＋ Add
            </button>
          </h4>
          <ul className="demo-attachments">
            <li>
              ▧ Education document{" "}
              <small>{selected.documentFileMetadataID ? "Attached document" : "No document attached"}</small>
            </li>
          </ul>
          {expanded ? (
            <div className="demo-page-actions">
              <button type="button" className="demo-secondary-button">
                Edit record
              </button>
              <button type="button" className="demo-secondary-button">
                Share page
              </button>
            </div>
          ) : null}
        </aside>
      ) : (
        <aside className="wireframe-demo-inspector wireframe-empty-inspector" aria-label="Record inspector">
          <p>Select a record to inspect it.</p>
        </aside>
      )}
    </section>
  );
}
