import { useEffect, useReducer, useRef } from "react";
import { useCreateDatabaseMutation, useDatabaseCapabilitiesQuery } from "../data/workflowQueries";
import type { LocalDatabaseCreationResult } from "../types";

interface Options { onError: (error: unknown) => void; onSuccess: (message: string) => void }
interface State { databaseName: string; profile: string; confirmed: boolean; created: LocalDatabaseCreationResult | null }
type Action = { type: "name" | "profile"; value: string } | { type: "confirm"; value: boolean } | { type: "created"; value: LocalDatabaseCreationResult } | { type: "start" };
function reducer(state: State, action: Action): State {
  if (action.type === "name") return { ...state, databaseName: action.value, confirmed: false, created: null };
  if (action.type === "profile") return { ...state, profile: action.value, confirmed: false, created: null };
  if (action.type === "confirm") return { ...state, confirmed: action.value };
  if (action.type === "created") return { ...state, created: action.value, confirmed: false };
  return { ...state, created: null };
}

/** Creation confirmation always belongs to the current filename and profile. */
export function useLocalDatabaseForm({ onError, onSuccess }: Options) {
  const capabilitiesQuery = useDatabaseCapabilitiesQuery();
  const capabilities = capabilitiesQuery.data ?? null;
  const creation = useCreateDatabaseMutation();
  const running = useRef(false);
  const [state, dispatch] = useReducer(reducer, { databaseName: "GemLife_Test.sqlite", profile: "gem-life-development", confirmed: false, created: null });
  useEffect(() => { if (capabilitiesQuery.error) onError(capabilitiesQuery.error); }, [capabilitiesQuery.error, onError]);
  const selectedProfile = capabilities?.profiles.find((item) => item.id === state.profile) ?? capabilities?.profiles[0];
  async function createDatabase() {
    if (!selectedProfile || !state.confirmed || running.current) return;
    running.current = true;
    dispatch({ type: "start" });
    try {
      const result = await creation.mutateAsync({ databaseName: state.databaseName, profile: selectedProfile.id, confirmCreation: true });
      dispatch({ type: "created", value: result });
      onSuccess(`${result.databaseName} created with ${result.migrationCount} migrations.`);
    } catch (error) { onError(error); }
    finally { running.current = false; }
  }
  return { ...state, capabilities, selectedProfile, creating: creation.isPending, createDatabase,
    setDatabaseName: (value: string) => dispatch({ type: "name", value }),
    setProfile: (value: string) => dispatch({ type: "profile", value }),
    setConfirmed: (value: boolean) => dispatch({ type: "confirm", value }),
  };
}
