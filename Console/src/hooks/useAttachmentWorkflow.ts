import { useReducer, useRef } from "react";
import { useUploadImageMutation } from "../data/workflowQueries";
import type { FileMetadata } from "../types";

interface State { busy: boolean; error: string | null }
type Action = { type: "start" } | { type: "finish" } | { type: "error"; message: string };
function reducer(state: State, action: Action): State {
  if (action.type === "start") return { busy: true, error: null };
  if (action.type === "finish") return { ...state, busy: false };
  return { ...state, error: action.message };
}
interface Options {
  label: string; ownerType: string; ownerID: string;
  onAttach: (metadata: FileMetadata | null) => Promise<void>;
}

/** Owns upload, picker cancellation, removal and errors behind one operation lock. */
export function useAttachmentWorkflow({ label, ownerType, ownerID, onAttach }: Options) {
  const [state, dispatch] = useReducer(reducer, { busy: false, error: null });
  const running = useRef(false);
  const upload = useUploadImageMutation();
  async function perform(operation: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    dispatch({ type: "start" });
    try { await operation(); }
    catch (error) { dispatch({ type: "error", message: error instanceof Error ? error.message : "Attachment operation failed." }); }
    finally { running.current = false; dispatch({ type: "finish" }); }
  }
  async function attach(file: File) {
    if (!file.type.toLowerCase().startsWith("image/") || !file.size) throw new Error("Choose a non-empty image file.");
    const metadata = await upload.mutateAsync({ file, kind: label.toLowerCase().replaceAll(" ", "-"), ownerType, ownerID });
    await onAttach(metadata);
  }
  return { ...state,
    handleFile: (file: File) => perform(() => attach(file)),
    choose: (select: () => Promise<File | null>) => perform(async () => { const file = await select(); if (file) await attach(file); }),
    remove: () => perform(() => onAttach(null)),
  };
}
