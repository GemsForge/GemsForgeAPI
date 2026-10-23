import { sendToNative, subscribeToNative } from "./index";

export type NativeFileKind = "image" | "csv";
export const IMAGE_FILE_ACCEPT = "image/*";

const MAX_BASE64_LENGTH = 14 * 1024 * 1024;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const PICKER_TIMEOUT_MS = 120_000;

/** Validate the browser/native image boundary before an attachment upload. */
export function validateImageFile(file: File): void {
  if (!file.type.toLowerCase().startsWith("image/") || !file.size) throw new Error("Choose a non-empty image file.");
}

/** Selected bytes only: no native path or arbitrary-path request crosses the bridge. */
export function hasNativeFilePicker() {
  return Boolean(window.webkit?.messageHandlers?.gemLife);
}

function decodeNativeFile(payload: Record<string, string> | undefined, kind: NativeFileKind): File {
  if (!payload?.name || /[/\\]/.test(payload.name) || !payload.base64 || payload.base64.length > MAX_BASE64_LENGTH)
    throw new Error("Invalid native file response.");
  const bytes = Uint8Array.from(atob(payload.base64), (character) => character.charCodeAt(0));
  const type = payload.mimeType ?? "";
  if (!bytes.length || bytes.length > MAX_FILE_BYTES || (kind === "image" && !type.startsWith("image/")))
    throw new Error("Unsupported or oversized native file.");
  return new File([bytes], payload.name, { type });
}

/** Request selected bytes from the native host and convert them into a browser File. */
export function pickNativeFile(kind: NativeFileKind = "image"): Promise<File | null> {
  return new Promise((resolve, reject) => {
    const requestID = crypto.randomUUID();
    let settled = false;
    let unsubscribe = () => {};
    const timer = setTimeout(() => finish(new Error("File selection timed out. Please try again.")), PICKER_TIMEOUT_MS);
    const finish = (error?: Error, file: File | null = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      if (error) reject(error);
      else resolve(file);
    };
    unsubscribe = subscribeToNative((message) => {
      if (message.requestID !== requestID) return;
      if (message.type === "error") {
        finish(new Error(message.payload?.message ?? "Native file selection failed."));
        return;
      }
      if (message.type !== "localFile") return;
      const payload = message.payload;
      if (payload?.cancelled === "true") {
        finish();
        return;
      }
      try {
        finish(undefined, decodeNativeFile(payload, kind));
      } catch (error) {
        finish(error instanceof Error ? error : new Error("Invalid native file."));
      }
    });
    try {
      if (!sendToNative({ type: kind === "image" ? "requestImage" : "requestFile", requestID }))
        finish(new Error("Native file selection is unavailable."));
    } catch {
      finish(new Error("Native file selection is unavailable."));
    }
  });
}
