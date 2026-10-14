import { sendToNative, subscribeToNative } from "./index";

/** Selected bytes only: no native path or arbitrary-path request crosses the bridge. */
export function hasNativeFilePicker() {
  return Boolean(window.webkit?.messageHandlers?.gemLife);
}

export function pickNativeFile(kind: "image" | "csv" = "image"): Promise<File | null> {
  return new Promise((resolve, reject) => {
    const requestID = crypto.randomUUID();
    const finish = (error?: Error, file: File | null = null) => {
      clearTimeout(timer); unsubscribe();
      if (error) reject(error); else resolve(file);
    };
    const unsubscribe = subscribeToNative((message) => {
      if (message.requestID !== requestID) return;
      if (message.type === "error") { finish(new Error(message.payload?.message ?? "Native file selection failed.")); return; }
      if (message.type !== "localFile") return;
      const payload = message.payload;
      if (payload?.cancelled === "true") { finish(); return; }
      try {
        if (!payload?.name || /[/\\]/.test(payload.name) || !payload.base64 || payload.base64.length > 14 * 1024 * 1024) throw new Error("Invalid native file response.");
        const bytes = Uint8Array.from(atob(payload.base64), (character) => character.charCodeAt(0));
        const type = payload.mimeType ?? "";
        if (!bytes.length || bytes.length > 10 * 1024 * 1024 || (kind === "image" && !type.startsWith("image/"))) throw new Error("Unsupported or oversized native file.");
        finish(undefined, new File([bytes], payload.name, { type }));
      } catch (error) { finish(error instanceof Error ? error : new Error("Invalid native file.")); }
    });
    const timer = setTimeout(() => finish(new Error("File selection timed out. Please try again.")), 120_000);
    try {
      if (!sendToNative({ type: kind === "image" ? "requestImage" : "requestFile", requestID })) finish(new Error("Native file selection is unavailable."));
    } catch { finish(new Error("Native file selection is unavailable.")); }
  });
}
