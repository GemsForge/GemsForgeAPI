import { useEffect, useState } from "react";
import { useCreateDatabaseMutation, useDatabaseCapabilitiesQuery } from "../data/workflowQueries";
import type { LocalDatabaseCreationResult } from "../types";

interface UseLocalDatabaseFormOptions {
  onError: (error: unknown) => void;
  onSuccess: (message: string) => void;
}

/** Owns the local-database creation workflow without coupling it to a view. */
export function useLocalDatabaseForm({ onError, onSuccess }: UseLocalDatabaseFormOptions) {
  const capabilitiesQuery = useDatabaseCapabilitiesQuery();
  const capabilities = capabilitiesQuery.data ?? null;
  const creation = useCreateDatabaseMutation();
  const [databaseName, setDatabaseName] = useState("GemLife_Test.sqlite");
  const [profile, setProfile] = useState("gem-life-development");
  const [confirmed, setConfirmed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<LocalDatabaseCreationResult | null>(null);

  useEffect(() => {
    if (capabilitiesQuery.error) onError(capabilitiesQuery.error);
  }, [capabilitiesQuery.error, onError]);

  const selectedProfile = capabilities?.profiles.find((item) => item.id === profile) ?? capabilities?.profiles[0];

  async function createDatabase() {
    if (!selectedProfile) return;
    setCreating(true);
    setCreated(null);
    try {
      const result = await creation.mutateAsync({
        databaseName,
        profile: selectedProfile.id,
        confirmCreation: confirmed,
      });
      setCreated(result);
      setConfirmed(false);
      onSuccess(`${result.databaseName} created with ${result.migrationCount} migrations.`);
    } catch (error) {
      onError(error);
    } finally {
      setCreating(false);
    }
  }

  return {
    capabilities,
    databaseName,
    setDatabaseName,
    profile,
    setProfile,
    confirmed,
    setConfirmed,
    creating,
    created,
    selectedProfile,
    createDatabase,
  };
}
