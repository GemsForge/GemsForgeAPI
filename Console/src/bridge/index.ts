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
    const message = (event as CustomEvent<GemLifeBridgeMessage>).detail;
    if (message?.type) listener(message);
  };

  window.addEventListener("gem-life-native-message", handleEvent);
  return () => window.removeEventListener("gem-life-native-message", handleEvent);
}
