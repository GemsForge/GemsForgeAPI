export type GemLifeBridgeMessageType =
  | "navigate"
  | "requestFile"
  | "requestImage"
  | "localFile"
  | "share"
  | "session"
  | "error";

export interface GemLifeBridgeMessage {
  type: GemLifeBridgeMessageType;
  requestID?: string;
  payload?: Record<string, string>;
}

export function isBridgeMessage(value: unknown): value is GemLifeBridgeMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<GemLifeBridgeMessage>;
  if (!["navigate", "requestFile", "requestImage", "localFile", "share", "session", "error"].includes(message.type ?? "")) return false;
  if (message.requestID !== undefined && typeof message.requestID !== "string") return false;
  return message.payload === undefined || (message.payload !== null && typeof message.payload === "object" && !Array.isArray(message.payload) && Object.values(message.payload).every((item) => typeof item === "string"));
}

interface WebKitMessageHandler {
  postMessage(message: GemLifeBridgeMessage): void;
}

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        gemLife?: WebKitMessageHandler;
      };
    };
  }
}

/** Sends a typed event to the native SwiftUI host when one is present. */
export function sendToNative(message: GemLifeBridgeMessage): boolean {
  const handler = window.webkit?.messageHandlers?.gemLife;
  if (!handler) return false;
  handler.postMessage(message);
  return true;
}

/** Subscribes to typed events dispatched by the native host. */
export function subscribeToNative(listener: (message: GemLifeBridgeMessage) => void) {
  const handleEvent = (event: Event) => {
    const message: unknown = (event as CustomEvent<unknown>).detail;
    if (isBridgeMessage(message)) listener(message);
  };

  window.addEventListener("gem-life-native-message", handleEvent);
  return () => window.removeEventListener("gem-life-native-message", handleEvent);
}
