import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { APIError, api } from "../../api";
import { useUploadImageMutation } from "../../data/workflowQueries";
import { useRecordBodyQuery, useSaveRecordBodyMutation } from "../../data/recordBodyQueries";

type Conflict = { markdown: string; revision: number };

export function WireframeRecordBody({ tableName, recordID }: { tableName: string; recordID: string }) {
  const bodyQuery = useRecordBodyQuery(tableName, recordID);
  const saveBody = useSaveRecordBodyMutation(tableName, recordID);
  const uploadImage = useUploadImageMutation();
  const [markdown, setMarkdown] = useState("");
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pasteSelection = useRef<{ start: number; end: number } | null>(null);
  const timer = useRef<number | null>(null);
  const markdownRef = useRef(markdown);
  const revisionRef = useRef(revision);
  const dirtyRef = useRef(dirty);
  const saveInFlight = useRef(false);
  markdownRef.current = markdown;
  revisionRef.current = revision;
  dirtyRef.current = dirty;

  useEffect(() => {
    if (!bodyQuery.data || dirtyRef.current) return;
    setMarkdown(bodyQuery.data.markdown);
    setRevision(bodyQuery.data.revision);
  }, [bodyQuery.data]);

  const save = async (value = markdownRef.current) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    if (!dirtyRef.current || saveInFlight.current) return;
    setError(null);
    saveInFlight.current = true;
    try {
      const saved = await saveBody.mutateAsync({ markdown: value, baseRevision: revisionRef.current });
      setMarkdown(saved.markdown);
      setRevision(saved.revision);
      setDirty(false);
      setSaved(true);
    } catch (reason) {
      if (reason instanceof APIError && reason.status === 409) {
        const currentBody = await api.getRecordBody(tableName, recordID);
        setConflict({ markdown: currentBody.markdown, revision: currentBody.revision });
      } else {
        setError(reason instanceof Error ? reason.message : "Page could not be saved.");
      }
    } finally {
      saveInFlight.current = false;
    }
  };

  useEffect(() => () => {
    if (dirtyRef.current) {
      if (timer.current !== null) window.clearTimeout(timer.current);
      if (dirtyRef.current) void saveBody.mutateAsync({ markdown: markdownRef.current, baseRevision: revisionRef.current });
    }
  }, []);

  if (bodyQuery.isLoading) return <p>Loading page…</p>;
  if (bodyQuery.isError) return <p role="alert">Page could not be loaded.</p>;

  return (
    <section className="wireframe-record-body" aria-label="Record page body">
      <label htmlFor="wireframe-record-body-editor">Page content (Markdown)</label>
      <textarea
        id="wireframe-record-body-editor"
        value={markdown}
        rows={12}
        onChange={(event) => {
          const value = event.currentTarget.value;
          setMarkdown(value);
          setDirty(true);
          setSaved(false);
          setConflict(null);
          if (timer.current !== null) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => void save(value), 800);
        }}
        onBlur={() => void save()}
        onPaste={(event) => {
          const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith("image/"));
          if (!file) return;
          event.preventDefault();
          const editor = event.currentTarget;
          pasteSelection.current = { start: editor.selectionStart, end: editor.selectionEnd };
          void uploadImage.mutateAsync({ file, kind: "image", ownerType: `RecordBody.${tableName}`, ownerID: recordID })
            .then((metadata) => {
              const insertion = `![${file.name}](${api.fileContentURL(metadata.id)})`;
              const { start, end } = pasteSelection.current ?? { start: markdownRef.current.length, end: markdownRef.current.length };
              const next = `${markdownRef.current.slice(0, start)}${insertion}${markdownRef.current.slice(end)}`;
              setMarkdown(next);
              setDirty(true);
              pasteSelection.current = null;
              window.requestAnimationFrame(() => {
                editor.focus();
                editor.setSelectionRange(start + insertion.length, start + insertion.length);
              });
            })
            .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Image upload failed."));
        }}
      />
      <p className="wireframe-record-body-status" aria-live="polite">
        {uploadImage.isPending ? "Uploading image…" : saveBody.isPending ? "Saving…" : dirty ? "Unsaved changes" : saved ? "Saved" : ""}
      </p>
      {error ? <p role="alert">{error}</p> : null}
      {conflict ? (
        <div role="alert" className="wireframe-record-body-conflict">
          <p>This page changed elsewhere. Review the saved version before continuing.</p>
          <div className="wireframe-record-body-preview">
            <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={safeMarkdownURL}>
              {conflict.markdown}
            </ReactMarkdown>
          </div>
          <button type="button" onClick={() => { setMarkdown(conflict.markdown); setRevision(conflict.revision); setDirty(false); setConflict(null); }}>
            Use saved
          </button>
          <button type="button" onClick={() => {
            const localMarkdown = markdownRef.current;
            const currentRevision = conflict.revision;
            setRevision(currentRevision);
            revisionRef.current = currentRevision;
            setConflict(null);
            setDirty(true);
            dirtyRef.current = true;
            void save(localMarkdown);
          }}>
            Keep mine
          </button>
        </div>
      ) : null}
      <div className="wireframe-record-body-preview" aria-label="Markdown preview">
        <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={safeMarkdownURL}>
          {markdown}
        </ReactMarkdown>
      </div>
    </section>
  );
}

export function safeMarkdownURL(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("/file-metadata/") && /^\/file-metadata\/[A-Za-z0-9_-]+\/content$/.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return "";
  try {
    const protocol = new URL(trimmed, window.location.origin).protocol;
    return ["http:", "https:", "mailto:"].includes(protocol) ? trimmed : "";
  } catch {
    return "";
  }
}
