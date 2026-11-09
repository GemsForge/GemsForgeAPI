import { useEffect, useMemo, useState } from "react";
import { Dialog, Form, SizableText, Theme } from "tamagui";
import { QueryFeedback } from "../../components/QueryFeedback";
import { GemButton, GemCard, GemSectionHeader, GemStatusPill, GemTextField } from "@gemsforge/ui";
import { usePagesQuery, usePageMutation } from "../../data/workflowQueries";
import type { ForgeKeeperPage, ForgeKeeperPatch } from "../../types";

/** Returns a stable visual marker for a ForgeKeeper page in the workspace tree. */
function pageIcon(page: ForgeKeeperPage): string {
  return page.parentID ? "◈" : "✦";
}

interface WorkspaceRow {
  id: string;
  name: string;
  type: string;
  status: string;
  nextThought: string;
}

type BlockEditor = { kind: "note" } | { kind: "row"; rowID: string | null };

/** A connected knowledge workspace backed by ForgeKeeper root pages. */
export function WorkspaceView({ onSuccess }: { onSuccess: (message: string) => void }) {
  const pagesQuery = usePagesQuery({ kind: "roots" });
  const patchPage = usePageMutation();
  const pages = useMemo(() => pagesQuery.data ?? [], [pagesQuery.data]);
  const [activePageID, setActivePageID] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [note, setNote] = useState("The best workspace lets structure emerge from thinking.");
  const [rows, setRows] = useState<WorkspaceRow[]>([
    {
      id: "chromalock",
      name: "Chromalock",
      type: "Project",
      status: "In progress",
      nextThought: "Design the co-op map",
    },
    {
      id: "handbook",
      name: "Database handbook",
      type: "Writing",
      status: "Draft",
      nextThought: "Add migration examples",
    },
  ]);
  const [blockEditor, setBlockEditor] = useState<BlockEditor | null>(null);
  const [editingLinks, setEditingLinks] = useState(false);
  const [linkedPageIDs, setLinkedPageIDs] = useState<number[]>([]);
  const activePage = pages.find((page) => page.id === activePageID) ?? pages[0] ?? null;
  const relatedPages = activePage
    ? pages.filter((page) => page.id !== activePage.id && linkedPageIDs.includes(page.id))
    : [];

  useEffect(() => {
    if (activePageID === null && pages[0]) setActivePageID(pages[0].id);
    if (activePageID !== null && pages.length > 0 && !pages.some((page) => page.id === activePageID)) {
      setActivePageID(pages[0].id);
    }
  }, [activePageID, pages]);

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
        .slice(0, 3)
        .map((page) => page.id),
    );
  }, [activePage?.id, pages]);

  const savePage = async (patch: ForgeKeeperPatch) => {
    if (!activePage) return;
    await patchPage.mutateAsync({ id: activePage.id, patch });
    setEditing(false);
    onSuccess("Page updated.");
  };

  const saveInlineField = async (patch: ForgeKeeperPatch) => {
    if (!activePage) return;
    const changed = Object.entries(patch).some(([key, value]) => value !== activePage[key as keyof ForgeKeeperPage]);
    if (changed) await savePage(patch);
  };

  return (
    <Theme name="knowledge">
      <section className="hybrid-workspace" aria-labelledby="workspace-title">
        <GemSectionHeader
          eyebrow="Gem Life · personal knowledge workspace"
          title="A home for ideas in motion"
          description="Keep your notes close, let structure emerge, and follow the links between your life."
          trailing={activePage ? <GemButton onClick={() => setEditing(true)}>Page options</GemButton> : undefined}
        />
        <QueryFeedback query={pagesQuery} />
        {activePage ? (
          <div className="hybrid-workspace-grid">
            <aside className="workspace-page-tree" aria-label="Workspace pages">
              <div className="workspace-tree-heading">
                <SizableText fontWeight="700">Your library</SizableText>
                <GemButton
                  variant="quiet"
                  aria-label="Open page manager"
                  onClick={() => (window.location.href = "/forgekeeper")}
                >
                  ＋
                </GemButton>
              </div>
              <nav aria-label="Root pages">
                {pages.map((page) => (
                  <button
                    type="button"
                    className={`workspace-page-link ${page.id === activePage.id ? "selected" : ""}`}
                    key={page.id}
                    onClick={() => setActivePageID(page.id)}
                  >
                    <span aria-hidden="true">{pageIcon(page)}</span>
                    <span>{page.title}</span>
                  </button>
                ))}
              </nav>
              <div className="workspace-tree-footer">
                <span className="eyebrow">A living archive</span>
                <SizableText>Thoughts, projects, and the links between them.</SizableText>
              </div>
            </aside>
            <section className="workspace-page-canvas" aria-label={`${activePage.title} page canvas`}>
              <div className="workspace-page-heading">
                <span className="workspace-page-icon" aria-hidden="true">
                  {pageIcon(activePage)}
                </span>
                <div className="workspace-inline-fields">
                  <SizableText className="eyebrow">
                    {activePage.updatedAt ? "Recently updated" : "Private page"}
                  </SizableText>
                  <GemTextField
                    label="Page title"
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onBlur={() => void saveInlineField({ title: draftTitle.trim() })}
                  />
                  <GemTextField
                    label="Page description"
                    multiline
                    rows={2}
                    value={draftDescription}
                    onChange={(event) => setDraftDescription(event.target.value)}
                    onBlur={() => void saveInlineField({ description: draftDescription.trim() })}
                  />
                </div>
              </div>
              <GemCard className="workspace-note-block">
                <div className="workspace-note-meta">
                  <SizableText className="eyebrow">A thought worth keeping</SizableText>
                  <span className="workspace-markdown-hint" aria-label="Sample note content, not saved">
                    Sample content · not saved
                  </span>
                </div>
                <div className="workspace-block-heading">
                  <SizableText className="workspace-note-copy">{note}</SizableText>
                  <GemButton tone="secondary" onClick={() => setBlockEditor({ kind: "note" })}>
                    Edit note
                  </GemButton>
                </div>
              </GemCard>
              <GemCard className="workspace-table-block">
                <div className="workspace-block-heading">
                  <div>
                    <SizableText className="eyebrow">Sample table · local demo</SizableText>
                    <SizableText className="workspace-block-title" fontSize="$5" fontWeight="700">
                      Things in motion
                    </SizableText>
                  </div>
                  <GemButton tone="secondary" onClick={() => setBlockEditor({ kind: "row", rowID: null })}>
                    ＋ Add row
                  </GemButton>
                </div>
                <div className="workspace-demo-table-wrap">
                  <table className="workspace-demo-table">
                    <caption className="sr-only">Things in motion</caption>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
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
                          <td>{row.name}</td>
                          <td>{row.type}</td>
                          <td>
                            <GemStatusPill tone={row.status === "In progress" ? "success" : "default"}>
                              {row.status}
                            </GemStatusPill>
                          </td>
                          <td>{row.nextThought}</td>
                          <td>
                            <GemButton
                              variant="quiet"
                              size="sm"
                              onClick={() => setBlockEditor({ kind: "row", rowID: row.id })}
                            >
                              Edit
                            </GemButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GemCard>
              <div className="workspace-lower-grid">
                <GemCard className="workspace-related-block">
                  <div className="workspace-block-heading">
                    <div>
                      <SizableText className="eyebrow">Linked from this page</SizableText>
                      <SizableText className="workspace-block-title" fontSize="$5" fontWeight="700">
                        Related thoughts
                      </SizableText>
                    </div>
                    <GemButton variant="quiet" size="sm" onClick={() => setEditingLinks((value) => !value)}>
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
                            <button
                              type="button"
                              aria-label={`Open ${page.title}`}
                              onClick={() => setActivePageID(page.id)}
                            >
                              <span aria-hidden="true">↗</span> {page.title}
                            </button>
                          </li>
                        ))
                      ) : (
                        <li className="workspace-no-links">No related pages selected yet.</li>
                      )}
                    </ul>
                  )}
                  <SizableText className="workspace-demo-caption">
                    Links are a local preview and are not saved.
                  </SizableText>
                </GemCard>
                <GemCard className="workspace-map-block">
                  <SizableText className="eyebrow">Knowledge map</SizableText>
                  <SizableText className="workspace-block-title" fontSize="$5" fontWeight="700">
                    Nearby pages
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
                                onClick={() => setActivePageID(page.id)}
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
                  <SizableText className="workspace-demo-caption">
                    A preview of this page’s current local links.
                  </SizableText>
                </GemCard>
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
  row: WorkspaceRow | null;
  onCancel: () => void;
  onSaveNote: (value: string) => void;
  onSaveRow: (row: WorkspaceRow) => void;
}) {
  const [noteDraft, setNoteDraft] = useState(note);
  const [rowDraft, setRowDraft] = useState<WorkspaceRow>(
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
