import { useState } from "react";
import { api } from "../../api";
import { GemButton } from "../../components/ui";

/** Preview and apply legacy record ownership assignments from the Live Database tools. */
export function HubOwnershipAssignment() {
  const [ownership, setOwnership] = useState<{ counts: Record<string, number>; message?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const preview = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.previewHubOwnership();
      setOwnership({ counts: result.unownedCounts });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not preview ownership assignment.");
    } finally {
      setBusy(false);
    }
  };

  const assign = async () => {
    if (!ownership || !Object.values(ownership.counts).some((count) => count > 0)) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.assignHubOwnership(ownership.counts);
      setOwnership({
        counts: {},
        message: `Assigned ${Object.values(result.assignedCounts).reduce((sum, count) => sum + count, 0)} records.`,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not assign ownership.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="record-form">
      <h3>Assign existing records to my hub</h3>
      <p className="muted">
        Use this only for legacy rows that already exist with no HubID. It does not create duplicates.
      </p>
      <GemButton tone="secondary" disabled={busy} onPress={() => void preview()}>
        {busy ? "Loading…" : "Preview ownership assignment"}
      </GemButton>
      {error && <p role="alert">{error}</p>}
      {ownership && (
        <>
          <p>
            {Object.entries(ownership.counts)
              .filter(([, count]) => count > 0)
              .map(([table, count]) => `${table}: ${count}`)
              .join(" · ") || "No unowned records found."}
          </p>
          <GemButton
            tone="secondary"
            disabled={busy || !Object.values(ownership.counts).some((count) => count > 0)}
            onPress={() => void assign()}
          >
            Assign existing records
          </GemButton>
          {ownership.message && <p role="status">{ownership.message}</p>}
        </>
      )}
    </section>
  );
}
