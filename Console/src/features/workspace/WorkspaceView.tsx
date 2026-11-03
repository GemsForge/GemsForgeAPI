import { useEffect, useMemo, useState } from "react";
import { Dialog, Form, SizableText } from "tamagui";
import { QueryFeedback } from "../../components/QueryFeedback";
import { GemButton, GemCard, GemSectionHeader, GemStatusPill, GemTextField } from "../../components/ui";
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

/** The Notion/Obsidian-inspired workspace surface backed by ForgeKeeper pages. */
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
    { id: "chromalock", name: "Chromalock", type: "Project", status: "In progress", nextThought: "Design the co-op map" },
    { id: "handbook", name: "Database handbook", type: "Writing", status: "Draft", nextThought: "Add migration examples" },
  ]);
  const [blockEditor, setBlockEditor] = useState<BlockEditor | null>(null);
  const [editingLinks, setEditingLinks] = useState(false);
  const [linkedPageIDs, setLinkedPageIDs] = useState<number[]>([]);
  const activePage = pages.find((page) => page.id === activePageID) ?? pages[0] ?? null;

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
    setLinkedPageIDs(pages.filter((page) => page.id !== activePage?.id).slice(0, 3).map((page) => page.id));
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
    <section className="hybrid-workspace" aria-labelledby="workspace-title">
      <GemSectionHeader
        eyebrow="Gem Life · private knowledge workspace"
        title="Your data, connected"
        description="Write freely, structure what matters, and follow the links between your life."
        trailing={activePage ? <GemButton onClick={() => setEditing(true)}>Page options</GemButton> : undefined}
      />
      <QueryFeedback query={pagesQuery} />
      {activePage ? (
        <div className="hybrid-workspace-grid">
          <aside className="workspace-page-tree" aria-label="Workspace pages">
            <div className="workspace-tree-heading">
              <SizableText fontWeight="700">Pages</SizableText>
              <GemButton variant="quiet" aria-label="Open page manager" onClick={() => (window.location.href = "/forgekeeper")}>
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
              <span className="eyebrow">Workspace</span>
              <SizableText>Everything is a page, a block, or a link.</SizableText>
            </div>
          </aside>
          <main className="workspace-page-canvas">
            <div className="workspace-page-heading">
              <span className="workspace-page-icon" aria-hidden="true">{pageIcon(activePage)}</span>
              <div className="workspace-inline-fields">
                <SizableText className="eyebrow">{activePage.updatedAt ? "Recently updated" : "Private page"}</SizableText>
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
              <SizableText className="eyebrow">A note to self</SizableText>
              <div className="workspace-block-heading">
                <SizableText className="workspace-note-copy">{note}</SizableText>
                <GemButton tone="secondary" onClick={() => setBlockEditor({ kind: "note" })}>Edit note</GemButton>
              </div>
            </GemCard>
            <GemCard className="workspace-table-block">
              <div className="workspace-block-heading">
                <div>
                  <SizableText className="eyebrow">Embedded table · editable block</SizableText>
                  <SizableText className="workspace-block-title" fontSize="$5" fontWeight="700">Things in motion</SizableText>
                </div>
                <GemButton tone="secondary" onClick={() => setBlockEditor({ kind: "row", rowID: null })}>＋ Add row</GemButton>
              </div>
              <div className="workspace-demo-table-wrap">
                <table className="workspace-demo-table">
                  <caption className="sr-only">Things in motion</caption>
                  <thead><tr><th>Name</th><th>Type</th><th>Status</th><th>Next thought</th><th><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td><td>{row.type}</td>
                        <td><GemStatusPill tone={row.status === "In progress" ? "success" : "default"}>{row.status}</GemStatusPill></td>
                        <td>{row.nextThought}</td>
                        <td><GemButton variant="quiet" size="sm" onClick={() => setBlockEditor({ kind: "row", rowID: row.id })}>Edit</GemButton></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GemCard>
            <div className="workspace-lower-grid">
              <GemCard>
                <div className="workspace-block-heading"><div><SizableText className="eyebrow">Linked from this page</SizableText><SizableText className="workspace-block-title" fontSize="$5" fontWeight="700">Related thoughts</SizableText></div><GemButton variant="quiet" size="sm" onClick={() => setEditingLinks((value) => !value)}>{editingLinks ? "Done" : "Edit list"}</GemButton></div>
                {editingLinks ? <ul className="workspace-link-list workspace-link-list-editing">
                  {pages.filter((page) => page.id !== activePage.id).map((page) => <li key={page.id}><label><input type="checkbox" checked={linkedPageIDs.includes(page.id)} onChange={() => setLinkedPageIDs((current) => current.includes(page.id) ? current.filter((id) => id !== page.id) : [...current, page.id])} />{page.title}</label></li>)}
                </ul> : <ul className="workspace-link-list">
                  {pages.filter((page) => linkedPageIDs.includes(page.id)).map((page) => <li key={page.id}><button type="button" onClick={() => setActivePageID(page.id)}>↗ {page.title}</button></li>)}
                </ul>}
              </GemCard>
              <GemCard>
                <SizableText className="eyebrow">Knowledge map</SizableText>
                <SizableText className="workspace-block-title" fontSize="$5" fontWeight="700">Nearby pages</SizableText>
                <div className="workspace-map" aria-label="Connected root pages">
                  <span className="map-node map-node-main">{pageIcon(activePage)}</span>
                  <span className="map-line map-line-a" />
                  <span className="map-line map-line-b" />
                  <span className="map-node map-node-a">◈</span>
                  <span className="map-node map-node-b">✎</span>
                </div>
                <SizableText className="muted">{pages.length} root pages in this workspace</SizableText>
              </GemCard>
            </div>
          </main>
        </div>
      ) : !pagesQuery.isLoading && !pagesQuery.error ? (
        <div className="empty-state">
          <SizableText className="workspace-block-title" fontSize="$6" fontWeight="700">No workspace pages yet</SizableText>
          <SizableText>Create a ForgeKeeper page to start your knowledge hub.</SizableText>
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
          row={blockEditor.kind === "row" ? rows.find((item) => item.id === blockEditor.rowID) ?? null : null}
          onCancel={() => setBlockEditor(null)}
          onSaveNote={(value) => { setNote(value); setBlockEditor(null); }}
          onSaveRow={(row) => {
            setRows((current) => row.id ? current.map((item) => item.id === row.id ? row : item) : [...current, { ...row, id: crypto.randomUUID() }]);
            setBlockEditor(null);
          }}
        />
      ) : null}
    </section>
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
  const [rowDraft, setRowDraft] = useState<WorkspaceRow>(row ?? { id: "", name: "", type: "", status: "Draft", nextThought: "" });
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()} modal>
      <Dialog.Portal><Dialog.Overlay className="table-kit-utility-backdrop" /><Dialog.Content className="table-kit-new-record-utility workspace-editor-dialog">
        <div className="table-kit-new-record-heading"><div><SizableText className="eyebrow">Canvas block</SizableText><Dialog.Title>{editor.kind === "note" ? "Edit note" : row ? "Edit table row" : "Add table row"}</Dialog.Title></div><Dialog.Close asChild><GemButton variant="quiet" size="sm" aria-label="Close block editor" onClick={onCancel}>×</GemButton></Dialog.Close></div>
        <Form className="edit-form" onSubmit={() => editor.kind === "note" ? onSaveNote(noteDraft.trim()) : onSaveRow(rowDraft)}>
          {editor.kind === "note" ? <GemTextField label="Note" multiline rows={5} value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} required /> : <>
            <GemTextField label="Name" value={rowDraft.name} onChange={(event) => setRowDraft({ ...rowDraft, name: event.target.value })} required />
            <GemTextField label="Type" value={rowDraft.type} onChange={(event) => setRowDraft({ ...rowDraft, type: event.target.value })} required />
            <GemTextField label="Status" value={rowDraft.status} onChange={(event) => setRowDraft({ ...rowDraft, status: event.target.value })} required />
            <GemTextField label="Next thought" value={rowDraft.nextThought} onChange={(event) => setRowDraft({ ...rowDraft, nextThought: event.target.value })} required />
          </>}
          <div className="dialog-actions"><Dialog.Close asChild><GemButton tone="secondary" type="button" onClick={onCancel}>Cancel</GemButton></Dialog.Close><GemButton type="submit">Save block</GemButton></div>
        </Form>
      </Dialog.Content></Dialog.Portal>
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
              <GemButton variant="quiet" size="sm" aria-label="Close editor" disabled={saving} onClick={onCancel}>×</GemButton>
            </Dialog.Close>
          </div>
          <Form
            className="edit-form"
            aria-busy={saving}
            onSubmit={async () => {
              await onSave({ title: title.trim(), description: description.trim() });
            }}
          >
            <GemTextField label="Page title" value={title} onChange={(event) => setTitle(event.target.value)} required />
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
                <GemButton tone="secondary" type="button" onClick={onCancel} disabled={saving}>Cancel</GemButton>
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
