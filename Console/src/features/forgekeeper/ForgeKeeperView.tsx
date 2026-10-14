import { usePagedRecords } from "../../hooks/usePagedRecords";
import { PaginationControls } from "../../components/PaginationControls";
import { useEffect, useRef, useState } from "react";
import type { Domain, ForgeKeeperPage, ForgeKeeperPatch } from "../../types";

interface ForgeKeeperViewProps {
  domain: Domain | null;
  pages: ForgeKeeperPage[];
  onLoadRoots: () => void;
  onLoadChildren: (pageID: number) => void;
  onPatch: (pageID: number, patch: ForgeKeeperPatch) => Promise<void>;
}

export function ForgeKeeperView({ domain, pages, onLoadRoots, onLoadChildren, onPatch }: ForgeKeeperViewProps) {
  const paging = usePagedRecords(pages);
  const [editingPage, setEditingPage] = useState<ForgeKeeperPage | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (editingPage) dialogRef.current?.showModal();
  }, [editingPage]);

  const closeEditor = () => {
    dialogRef.current?.close();
    setEditingPage(null);
  };

  return (
    <>
      <PaginationControls {...paging} label="ForgeKeeper" />
      <div className="content-heading">
        <div>
          <p className="eyebrow">ForgeKeeper pages</p>
          <h2>{domain?.title ?? "Choose a domain"}</h2>
          <p className="muted">{domain?.description ?? "Select a domain to inspect its pages."}</p>
        </div>
        <button className="secondary-button" onClick={onLoadRoots}>Show all root pages</button>
      </div>
      <div className="page-list">
        {pages.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">⌁</div><h3>No ForgeKeeper pages yet</h3><p>This domain is ready for pages from your Notes import workflow.</p></div>
        ) : paging.items.map((page) => (
          <article className="page-card" key={page.id}>
            <div className="page-card-main">
              <div className="page-meta"><span className="page-id">#{page.id}</span><span>{page.parentID ? "Child page" : "Root page"}</span></div>
              <h3>{page.title}</h3>
              <p>{page.description || "No description"}</p>
            </div>
            <div className="page-actions">
              <button className="text-button" aria-label={`Show children of ${page.title}`} onClick={() => onLoadChildren(page.id)}>Children</button>
              <button className="primary-button small" aria-label={`Edit ${page.title}`} onClick={() => setEditingPage(page)}>Edit</button>
            </div>
          </article>
        ))}
      </div>
      <section className="import-card">
        <div className="import-copy"><p className="eyebrow">Coming next</p><h3>Upload pages from Apple Notes</h3><p>Drop a structured export here once the ForgeKeeper create/import workflow is defined.</p></div>
        <div className="upload-placeholder"><span className="upload-symbol">↑</span><span>Notes import draft</span><small>Not connected yet</small></div>
      </section>
      <dialog ref={dialogRef} aria-labelledby="page-editor-title" onCancel={(event) => { event.preventDefault(); closeEditor(); }}>
        {editingPage && <PageEditor page={editingPage} pages={pages} onSave={async (patch) => { await onPatch(editingPage.id, patch); closeEditor(); }} onCancel={closeEditor} />}
      </dialog>
    </>
  );
}

function PageEditor({ page, pages, onSave, onCancel }: { page: ForgeKeeperPage; pages: ForgeKeeperPage[]; onSave: (patch: ForgeKeeperPatch) => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState(page.title);
  const [description, setDescription] = useState(page.description);
  const [parentID, setParentID] = useState(page.parentID?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);

  return (
    <form className="edit-form" aria-busy={saving} onKeyDown={(event) => { if (event.key === "Escape" && saving) event.preventDefault(); }} onSubmit={async (event) => {
      event.preventDefault();
      if (savingRef.current) return;
      savingRef.current = true; setSaving(true); setError(null);
      try { await onSave({ title, description, parentID: parentID ? Number(parentID) : null }); }
      catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save the page."); }
      finally { savingRef.current = false; setSaving(false); }
    }}>
      <div className="dialog-heading"><div><p className="eyebrow">ForgeKeeper page</p><h2 id="page-editor-title">Edit metadata</h2></div><button type="button" className="icon-button" aria-label="Close page editor" disabled={saving} onClick={onCancel}>×</button></div>
      <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
      <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} required /></label>
      <label>Parent page<select value={parentID} onChange={(event) => setParentID(event.target.value)}><option value="">Root page</option>{pages.filter((item) => item.id !== page.id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      {error && <p role="alert">{error}</p>}
      <div className="dialog-actions"><button type="button" className="secondary-button" disabled={saving} onClick={onCancel}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div>
    </form>
  );
}
