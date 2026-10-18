interface AppleAuthorizationResponse {
  authorization?: { id_token?: string; state?: string };
}

interface AppleAuthClient {
  init: (options: {
    clientId: string;
    scope: string;
    redirectURI: string;
    state: string;
    nonce: string;
    usePopup: boolean;
  }) => void;
  signIn: () => Promise<AppleAuthorizationResponse>;
}

declare global {
  interface Window {
    AppleID?: { auth: AppleAuthClient };
  }
}

const APPLE_JS_URL = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
let sdkLoad: Promise<AppleAuthClient> | undefined;

function getAppleClient(): Promise<AppleAuthClient> {
  if (window.AppleID?.auth) return Promise.resolve(window.AppleID.auth);
  if (!sdkLoad) {
    sdkLoad = new Promise<AppleAuthClient>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = APPLE_JS_URL;
      script.async = true;
      script.onload = () => {
        if (window.AppleID?.auth) resolve(window.AppleID.auth);
        else reject(new Error("Apple’s sign-in service did not initialize. Check the network and try again."));
      };
      script.onerror = () =>
        reject(new Error("Apple’s sign-in service could not be loaded. Check the network and try again."));
      document.head.append(script);
    }).catch((error: unknown) => {
      sdkLoad = undefined;
      throw error;
    });
  }
  return sdkLoad!;
}

export function getAppleSignInConfiguration(): { clientID: string; redirectURI: string } | null {
  const clientID = import.meta.env.VITE_APPLE_CLIENT_ID?.trim();
  const redirectURI = import.meta.env.VITE_APPLE_REDIRECT_URI?.trim();
  if (!clientID || !redirectURI) return null;
  try {
    const redirect = new URL(redirectURI);
    const isIP = /^\d{1,3}(\.\d{1,3}){3}$/.test(redirect.hostname) || redirect.hostname.includes(":");
    if (
      redirect.protocol !== "https:" ||
      isIP ||
      redirect.hostname === "localhost" ||
      redirect.hostname.endsWith(".localhost") ||
      redirect.hash
    ) {
      return null;
    }
  } catch {
    return null;
  }
  return { clientID, redirectURI };
}

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function requestAppleIdentityToken(
  challenge: { nonce: string },
  configuration: { clientID: string; redirectURI: string },
): Promise<string> {
  const state = randomState();
  const apple = await getAppleClient();
  apple.init({
    clientId: configuration.clientID,
    scope: "",
    redirectURI: configuration.redirectURI,
    state,
    nonce: challenge.nonce,
    usePopup: true,
  });
  const response = await apple.signIn();
  if (response.authorization?.state !== state)
    throw new Error("Apple sign-in could not be verified. Please try again.");
  const identityToken = response.authorization.id_token;
  if (!identityToken) throw new Error("Apple did not return an identity token. Please try again.");
  return identityToken;
}

export function appleSignInError(error: unknown): string {
  const code = typeof error === "object" && error !== null && "error" in error ? String(error.error) : "";
  if (code === "popup_closed_by_user" || (error instanceof Error && /cancel|closed/i.test(error.message))) {
    return "Sign-in was cancelled. You can try again when you’re ready.";
  }
  return error instanceof Error ? error.message : "Apple sign-in could not be completed. Please try again.";
}
