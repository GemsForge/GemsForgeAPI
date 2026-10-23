import { useCreateEducationMutation } from "../../data/recordQueries";

interface EducationRecordActionsOptions {
  /** Selects a newly created record in the owning feature view. */
  onCreated: (id: string) => void;
}

interface EducationRecordActionsResult {
  create: ReturnType<typeof useCreateEducationMutation>;
  publish: (rows: Record<string, unknown>[]) => Promise<void>;
}

/**
 * Compose Education-owned create and intake behavior for the feature view.
 * The hook owns mutation behavior while the view owns the surrounding layout.
 */
export function useEducationRecordActions({
  onCreated,
}: EducationRecordActionsOptions): EducationRecordActionsResult {
  const create = useCreateEducationMutation();
  const publish = async (rows: Record<string, unknown>[]) => {
    for (const row of rows) {
      const created = await create.mutateAsync(row as Parameters<typeof create.mutateAsync>[0]);
      onCreated(created.id);
    }
  };

  return { create, publish };
}
