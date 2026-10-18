interface SupabaseAuthConfiguration {
  url: string;
  publishableKey: string;
}

interface SupabasePasswordResponse {
  access_token?: unknown;
}

export function getSupabaseSignInConfiguration(): SupabaseAuthConfiguration | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") return null;
    return { url: parsed.origin, publishableKey };
  } catch {
    return null;
  }
}

/** Exchange email/password for a short-lived Supabase access token without persisting either token. */
export async function requestSupabaseAccessToken(email: string, password: string): Promise<string> {
  const configuration = getSupabaseSignInConfiguration();
  if (!configuration)
    throw new Error("Supabase sign-in is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");

  let response: Response;
  try {
    response = await fetch(`${configuration.url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: configuration.publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: email.trim(), password }),
      cache: "no-store",
    });
  } catch {
    throw new Error("Cannot reach Supabase Auth. Check your connection and try again.");
  }

  if (response.status === 429) throw new Error("Too many sign-in attempts. Wait a moment, then try again.");
  if (!response.ok) {
    const result = (await response.json().catch(() => ({}))) as { error_description?: unknown; msg?: unknown };
    if (response.status === 400 || response.status === 401) {
      throw new Error("Email or password is incorrect. Ask the Gem Life owner if your account should have access.");
    }
    throw new Error(typeof result.msg === "string" ? result.msg : "Supabase could not complete sign-in. Try again.");
  }

  const result = (await response.json()) as SupabasePasswordResponse;
  if (typeof result.access_token !== "string" || !result.access_token) {
    throw new Error("Supabase did not return a sign-in token. Try again.");
  }
  return result.access_token;
}
