import { useEffect, useMemo, useState } from "react";
import { Dialog, Form, SizableText, Theme } from "tamagui";
import { useSearchParams } from "react-router-dom";
import { QueryFeedback } from "../../components/QueryFeedback";
import { GemButton, GemCard, GemStatusPill, GemTextField } from "@gemsforge/ui";
import { usePagesQuery, usePageMutation } from "../../data/workflowQueries";
import type { ForgeKeeperPage, ForgeKeeperPatch } from "../../types";
import { inspectionBypassEnabled } from "../../auth/session";
import { workspacePreviewPages, workspacePreviewRows, type WorkspacePreviewRow } from "./workspacePreviewData";

/** Returns a stable visual marker for a ForgeKeeper page in the workspace tree. */
function pageIcon(page: ForgeKeeperPage): string {
  return page.parentID ? "◈" : "✦";
}

function pageUpdatedLabel(updatedAt?: string | null): string {
  if (!updatedAt) return "Created privately";
  const updated = new Date(updatedAt);
  if (Number.isNaN(updated.getTime())) return "Updated";
  const now = new Date();
  const sameDay = updated.toDateString() === now.toDateString();
  return sameDay
    ? "Updated today"
    : `Updated ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(updated)}`;
}

type BlockEditor = { kind: "note" } | { kind: "row"; rowID: string | null };

/** A connected knowledge workspace backed by ForgeKeeper root pages. */
export function WorkspaceView({ onSuccess }: { onSuccess: (message: string) => void }) {
  const pagesQuery = usePagesQuery({ kind: "roots" }, !inspectionBypassEnabled);
  const patchPage = usePageMutation();
  const pages = useMemo(
    () =>
      inspectionBypassEnabled
        ? pagesQuery.data?.length
          ? pagesQuery.data
          : workspacePreviewPages
        : (pagesQuery.data ?? []),
    [pagesQuery.data],
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const [activePageID, setActivePageID] = useState<number | null>(() => {
    const page = Number(new URLSearchParams(window.location.search).get("page"));
    return Number.isSafeInteger(page) && page > 0 ? page : null;
  });
  const [editing, setEditing] = useState(false);
  const [editingMetadata, setEditingMetadata] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [note, setNote] = useState(
    "The best ideas begin as observations.\nKeep them close long enough to see what they connect to.",
  );
  const [rows, setRows] = useState<WorkspacePreviewRow[]>(workspacePreviewRows);
  const [blockEditor, setBlockEditor] = useState<BlockEditor | null>(null);
  const [editingLinks, setEditingLinks] = useState(false);
  const [linkedPageIDs, setLinkedPageIDs] = useState<number[]>([]);
  const routePageID = Number(searchParams.get("page"));
  const activePage =
    pages.find((page) => page.id === routePageID) ?? pages.find((page) => page.id === activePageID) ?? pages[0] ?? null;
  const relatedPages = activePage
    ? pages.filter((page) => page.id !== activePage.id && linkedPageIDs.includes(page.id))
    : [];

  useEffect(() => {
    if (Number.isSafeInteger(routePageID) && pages.some((page) => page.id === routePageID)) {
      setActivePageID(routePageID);
      return;
    }
    if (activePageID === null && pages[0]) setActivePageID(pages[0].id);
    if (activePageID !== null && pages.length > 0 && !pages.some((page) => page.id === activePageID)) {
      setActivePageID(pages[0].id);
    }
  }, [activePageID, pages, routePageID]);

  const selectPage = (pageID: number) => {
    setActivePageID(pageID);
    setSearchParams({ page: String(pageID) });
  };

  useEffect(() => {
    if (activePage) {
      setDraftTitle(activePage.title);
      setDraftDescription(activePage.description);
    }
  }, [activePage]);

  useEffect(() => {
    setLinkedPageIDs(
      pages
        .filter((page) => page.id !== activePage?.id)
        .filter((page) => activePage?.title !== "Field notes" || page.title !== "Personal systems")
        .slice(0, 2)
        .map((page) => page.id),
    );
  }, [activePage?.id, activePage?.title, pages]);

  const savePage = async (patch: ForgeKeeperPatch) => {
    if (!activePage) return;
    if (inspectionBypassEnabled) {
      setEditing(false);
      onSuccess("Preview mode: page changes are not saved.");
      return;
    }
    await patchPage.mutateAsync({ id: activePage.id, patch });
    setEditing(false);
    onSuccess("Page updated.");
  };

  const saveMetadata = async () => {
    if (!activePage) return;
    if (inspectionBypassEnabled) {
      setEditingMetadata(false);
      onSuccess("Preview mode: page changes are not saved.");
      return;
    }
    const patch = { title: draftTitle.trim(), description: draftDescription.trim() };
    const changed = Object.entries(patch).some(([key, value]) => value !== activePage[key as keyof ForgeKeeperPage]);
    if (changed) {
      await patchPage.mutateAsync({ id: activePage.id, patch });
      onSuccess("Page updated.");
    }
    setEditingMetadata(false);
  };

  return (
    <Theme name="knowledge">
      <section className="hybrid-workspace" aria-label="Connected knowledge workspace">
        {!inspectionBypassEnabled ? <QueryFeedback query={pagesQuery} /> : null}
        {activePage ? (
          <div className="hybrid-workspace-grid">
            <section className="workspace-page-canvas" aria-label={`${activePage.title} page canvas`}>
              <div className="workspace-page-heading">
                <div className="workspace-inline-fields">
                  <div className="workspace-page-meta">
                    <span>{pageUpdatedLabel(activePage.updatedAt)}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Private page <span aria-hidden="true">♙</span>
                    </span>
                    {inspectionBypassEnabled ? <span className="workspace-preview-badge">Preview</span> : null}
                  </div>
                  {editingMetadata ? (
                    <>
                      <GemTextField
                        label="Page title"
                        showLabel={false}
                        className="workspace-page-title-input"
                        value={draftTitle}
                        onChange={(event) => setDraftTitle(event.target.value)}
                      />
                      <GemTextField
                        label="Page description"
                        showLabel={false}
                        className="workspace-page-description-input"
                        multiline
                        rows={2}
                        value={draftDescription}
                        onChange={(event) => setDraftDescription(event.target.value)}
                      />
                      <GemButton
                        size="sm"
                        disabled={!draftTitle.trim() || !draftDescription.trim() || patchPage.isPending}
                        onClick={() => void saveMetadata()}
                      >
                        {inspectionBypassEnabled ? "Done" : patchPage.isPending ? "Saving…" : "Save changes"}
                      </GemButton>
                    </>
                  ) : (
                    <>
                      <h1 className="workspace-page-title">{draftTitle || activePage.title}</h1>
                      <p className="workspace-page-description">{draftDescription || activePage.description}</p>
                    </>
                  )}
                </div>
                <div className="workspace-page-actions">
                  <GemButton variant="quiet" aria-label="Edit page details" onClick={() => setEditingMetadata(true)}>
                    ✎
                  </GemButton>
                  <GemButton variant="quiet" aria-label="Page options" onClick={() => setEditing(true)}>
                    ···
                  </GemButton>
                </div>
              </div>
              <GemCard className="workspace-note-block">
                <div className="workspace-note-meta">
                  <SizableText className="eyebrow">A thought worth keeping</SizableText>
                  <span className="workspace-markdown-hint" aria-label="Local demo note, not saved">
                    Local sample · Markdown
                  </span>
                </div>
                <div className="workspace-note-layout">
                  <SizableText className="workspace-note-copy">{note}</SizableText>
                  <GemButton
                    tone="secondary"
                    className="workspace-knowledge-action"
                    aria-label="Edit note"
                    onClick={() => setBlockEditor({ kind: "note" })}
                  >
                    ✎
                  </GemButton>
                </div>
                <div className="workspace-note-tags">
                  <span>#note</span>
                  <span aria-hidden="true">M↓</span>
                  <span>Markdown</span>
                </div>
              </GemCard>
              <GemCard className="workspace-table-block">
                <div className="workspace-block-heading">
                  <div>
                    <SizableText className="workspace-block-title" fontSize="$5" fontWeight="700">
                      Things in motion
                    </SizableText>
                    <SizableText className="workspace-demo-caption">Sample table · local demo</SizableText>
                  </div>
                  <GemButton
                    tone="secondary"
                    className="workspace-knowledge-action"
                    onClick={() => setBlockEditor({ kind: "row", rowID: null })}
                  >
                    ＋ Add row
                  </GemButton>
                </div>
                <div className="workspace-demo-table-wrap">
                  <table className="workspace-demo-table">
                    <caption className="sr-only">Things in motion</caption>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Kind</th>
                        <th>Status</th>
                        <th>Next thought</th>
                        <th>
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <span className="workspace-row-icon" aria-hidden="true">
                              ▱
                            </span>
                            {row.name}
                          </td>
                          <td>{row.type}</td>
                          <td>
                            <GemStatusPill tone={row.status === "Draft" ? "warning" : "success"}>
                              {row.status}
                            </GemStatusPill>
                          </td>
                          <td>{row.nextThought}</td>
                          <td className="workspace-row-action-cell">
                            <button
                              type="button"
                              className="workspace-row-edit"
                              aria-label={`Edit ${row.name}`}
                              onClick={() => setBlockEditor({ kind: "row", rowID: row.id })}
                            >
                              ✎
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GemCard>
              <div className="workspace-lower-grid">
                <section className="workspace-related-block" aria-labelledby="related-thoughts-title">
                  <div className="workspace-block-heading">
                    <div>
                      <SizableText
                        className="workspace-block-title"
                        fontSize="$5"
                        fontWeight="700"
                        id="related-thoughts-title"
                      >
                        <span aria-hidden="true">↗</span>
                        Related thoughts
                      </SizableText>
                    </div>
                    <GemButton
                      variant="quiet"
                      size="sm"
                      className="workspace-knowledge-action"
                      onClick={() => setEditingLinks((value) => !value)}
                    >
                      {editingLinks ? "Done" : "Edit list"}
                    </GemButton>
                  </div>
                  {editingLinks ? (
                    <ul className="workspace-link-list workspace-link-list-editing">
                      {pages
                        .filter((page) => page.id !== activePage.id)
                        .map((page) => (
                          <li key={page.id}>
                            <label>
                              <input
                                type="checkbox"
                                checked={linkedPageIDs.includes(page.id)}
                                aria-label={`Link ${page.title} from ${activePage.title}`}
                                onChange={() =>
                                  setLinkedPageIDs((current) =>
                                    current.includes(page.id)
                                      ? current.filter((id) => id !== page.id)
                                      : [...current, page.id],
                                  )
                                }
                              />
                              {page.title}
                            </label>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <ul className="workspace-link-list">
                      {relatedPages.length > 0 ? (
                        relatedPages.map((page) => (
                          <li key={page.id}>
                            <button type="button" aria-label={`Open ${page.title}`} onClick={() => selectPage(page.id)}>
                              <span aria-hidden="true">↗</span> {page.title}
                            </button>
                          </li>
                        ))
                      ) : (
                        <li className="workspace-no-links">No related pages selected yet.</li>
                      )}
                    </ul>
                  )}
                  <SizableText className="workspace-demo-caption" aria-label="Sample page links, not saved">
                    Local preview links · not saved
                  </SizableText>
                </section>
                <section className="workspace-map-block" aria-labelledby="knowledge-map-title">
                  <SizableText
                    className="workspace-block-title"
                    fontSize="$5"
                    fontWeight="700"
                    id="knowledge-map-title"
                  >
                    <span aria-hidden="true">♧</span>
                    Knowledge map
                  </SizableText>
                  <nav className="workspace-map-scroll" aria-label={`Pages connected to ${activePage.title}`}>
                    <div
                      className={`workspace-map ${relatedPages.length === 0 ? "workspace-map-empty" : ""}`}
                      style={{ minWidth: `${Math.max(320, relatedPages.length * 152)}px` }}
                    >
                      {relatedPages.length > 0 ? (
                        <svg
                          className="workspace-map-lines"
                          viewBox="0 0 100 100"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                        >
                          {relatedPages.map((page, index) => (
                            <line
                              key={page.id}
                              x1="50"
                              y1="32"
                              x2={((index + 0.5) / relatedPages.length) * 100}
                              y2="78"
                            />
                          ))}
                        </svg>
                      ) : null}
                      <span className="map-node map-node-main" aria-current="page">
                        <span className="map-node-icon" aria-hidden="true">
                          {pageIcon(activePage)}
                        </span>
                        <span>{activePage.title}</span>
                      </span>
                      {relatedPages.length > 0 ? (
                        <ul
                          className="workspace-map-nodes"
                          aria-label="Directly linked pages"
                          style={{ gridTemplateColumns: `repeat(${relatedPages.length}, minmax(0, 1fr))` }}
                        >
                          {relatedPages.map((page) => (
                            <li key={page.id}>
                              <button
                                type="button"
                                className="map-node"
                                aria-label={`Open ${page.title}`}
                                onClick={() => selectPage(page.id)}
                              >
                                <span className="map-node-icon" aria-hidden="true">
                                  {pageIcon(page)}
                                </span>
                                <span>{page.title}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="workspace-map-empty-copy">
                          No linked pages yet. Use Edit list to connect a thought.
                        </p>
                      )}
                    </div>
                  </nav>
                  <SizableText className="workspace-demo-caption">Direct links from this page</SizableText>
                </section>
              </div>
            </section>
          </div>
        ) : !pagesQuery.isLoading && !pagesQuery.error ? (
          <div className="workspace-empty-state">
            <SizableText className="workspace-block-title" fontSize="$6" fontWeight="700">
              Your library is ready for its first page
            </SizableText>
            <SizableText>Create a ForgeKeeper page to begin collecting ideas and connections.</SizableText>
            <GemButton onClick={() => (window.location.href = "/forgekeeper")}>Open page manager</GemButton>
          </div>
        ) : null}
        {activePage && editing ? (
          <PageEditorDialog
            page={activePage}
            saving={patchPage.isPending}
            error={patchPage.error}
            onCancel={() => setEditing(false)}
            onSave={savePage}
          />
        ) : null}
        {blockEditor ? (
          <BlockEditorDialog
            editor={blockEditor}
            note={note}
            row={blockEditor.kind === "row" ? (rows.find((item) => item.id === blockEditor.rowID) ?? null) : null}
            onCancel={() => setBlockEditor(null)}
            onSaveNote={(value) => {
              setNote(value);
              setBlockEditor(null);
            }}
            onSaveRow={(row) => {
              setRows((current) =>
                row.id
                  ? current.map((item) => (item.id === row.id ? row : item))
                  : [...current, { ...row, id: crypto.randomUUID() }],
              );
              setBlockEditor(null);
            }}
          />
        ) : null}
      </section>
    </Theme>
  );
}

/** Dialog editor shared by the canvas note and editable table row blocks. */
function BlockEditorDialog({
  editor,
  note,
  row,
  onCancel,
  onSaveNote,
  onSaveRow,
}: {
  editor: BlockEditor;
  note: string;
  row: WorkspacePreviewRow | null;
  onCancel: () => void;
  onSaveNote: (value: string) => void;
  onSaveRow: (row: WorkspacePreviewRow) => void;
}) {
  const [noteDraft, setNoteDraft] = useState(note);
  const [rowDraft, setRowDraft] = useState<WorkspacePreviewRow>(
    row ?? { id: "", name: "", type: "", status: "Draft", nextThought: "" },
  );
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()} modal>
      <Dialog.Portal>
        <Dialog.Overlay className="table-kit-utility-backdrop" />
        <Dialog.Content className="table-kit-new-record-utility workspace-editor-dialog">
          <div className="table-kit-new-record-heading">
            <div>
              <SizableText className="eyebrow">Sample content · not saved</SizableText>
              <Dialog.Title>
                {editor.kind === "note" ? "Edit note" : row ? "Edit table row" : "Add table row"}
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <GemButton variant="quiet" size="sm" aria-label="Close block editor" onClick={onCancel}>
                ×
              </GemButton>
            </Dialog.Close>
          </div>
          <Form
            className="edit-form"
            onSubmit={() => (editor.kind === "note" ? onSaveNote(noteDraft.trim()) : onSaveRow(rowDraft))}
          >
            {editor.kind === "note" ? (
              <GemTextField
                label="Note"
                multiline
                rows={5}
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                required
              />
            ) : (
              <>
                <GemTextField
                  label="Name"
                  value={rowDraft.name}
                  onChange={(event) => setRowDraft({ ...rowDraft, name: event.target.value })}
                  required
                />
                <GemTextField
                  label="Type"
                  value={rowDraft.type}
                  onChange={(event) => setRowDraft({ ...rowDraft, type: event.target.value })}
                  required
                />
                <GemTextField
                  label="Status"
                  value={rowDraft.status}
                  onChange={(event) => setRowDraft({ ...rowDraft, status: event.target.value })}
                  required
                />
                <GemTextField
                  label="Next thought"
                  value={rowDraft.nextThought}
                  onChange={(event) => setRowDraft({ ...rowDraft, nextThought: event.target.value })}
                  required
                />
              </>
            )}
            <div className="dialog-actions">
              <Dialog.Close asChild>
                <GemButton tone="secondary" type="button" onClick={onCancel}>
                  Cancel
                </GemButton>
              </Dialog.Close>
              <GemButton type="submit">Keep in this preview</GemButton>
            </div>
          </Form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

/** Shared Tamagui dialog for editing the active page metadata. */
function PageEditorDialog({
  page,
  saving,
  error,
  onCancel,
  onSave,
}: {
  page: ForgeKeeperPage;
  saving: boolean;
  error: Error | null;
  onCancel: () => void;
  onSave: (patch: ForgeKeeperPatch) => Promise<void>;
}) {
  const [title, setTitle] = useState(page.title);
  const [description, setDescription] = useState(page.description);
  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onCancel()} modal>
      <Dialog.Portal>
        <Dialog.Overlay className="table-kit-utility-backdrop" />
        <Dialog.Content className="table-kit-new-record-utility workspace-editor-dialog">
          <div className="table-kit-new-record-heading">
            <div>
              <SizableText className="eyebrow">Page editor</SizableText>
              <Dialog.Title>Edit page</Dialog.Title>
              <div className="table-kit-new-record-description">
                <Dialog.Description>Changes are saved to your workspace page.</Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <GemButton variant="quiet" size="sm" aria-label="Close editor" disabled={saving} onClick={onCancel}>
                ×
              </GemButton>
            </Dialog.Close>
          </div>
          <Form
            className="edit-form"
            aria-busy={saving}
            onSubmit={async () => {
              await onSave({ title: title.trim(), description: description.trim() });
            }}
          >
            <GemTextField
              label="Page title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
            <GemTextField
              label="Page description"
              multiline
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
            />
            {error && <SizableText role="alert">{error.message}</SizableText>}
            <div className="dialog-actions">
              <Dialog.Close asChild>
                <GemButton tone="secondary" type="button" onClick={onCancel} disabled={saving}>
                  Cancel
                </GemButton>
              </Dialog.Close>
              <GemButton type="submit" disabled={saving || !title.trim() || !description.trim()}>
                {saving ? "Saving…" : "Save page"}
              </GemButton>
            </div>
          </Form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
