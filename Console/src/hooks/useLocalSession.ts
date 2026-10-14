import { useRef, useState } from "react";
import { useIsMutating, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { sendToNative } from "../bridge";

/** Local workspace lifecycle, not API authentication or an access-control boundary. */
export function useLocalSession() {
  const client = useQueryClient();
  const [active, setActive] = useState(true);
  const [generation, setGeneration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const pendingWrites = useIsMutating();
  const endingRef = useRef(false);
  const health = useQuery({ queryKey: ["local-api-health"], queryFn: ({ signal }) => api.getHealth(signal),
    enabled: active, retry: false, staleTime: 5000, refetchInterval: active ? 30_000 : false });
  async function end() {
    if (endingRef.current || client.isMutating() > 0) { setError("Wait for the current save to finish before ending the local session."); return false; }
    endingRef.current = true; setEnding(true); setError(null);
    try {
      sendToNative({ type: "session", requestID: crypto.randomUUID(), payload: { action: "end" } });
      await client.cancelQueries();
      if (client.isMutating() > 0) { setError("A save is still in progress. Please try again after it finishes."); return false; }
      setActive(false);
      client.clear();
      setGeneration((value) => value + 1);
      return true;
    } catch { setError("Could not end the local session. Close any file picker and try again."); return false; }
    finally { endingRef.current = false; setEnding(false); }
  }
  return { active, generation, error, ending, pendingWrites, health, end,
    resume: () => { setError(null); setActive(true); } };
}
