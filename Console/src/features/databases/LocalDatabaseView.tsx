import { useEffect, useState } from "react";
import { api } from "../../api";
import type { LocalDatabaseCapabilities, LocalDatabaseCreationResult } from "../../types";

interface LocalDatabaseViewProps {
  onError: (error: unknown) => void;
  onSuccess: (message: string) => void;
}

export function LocalDatabaseView({ onError, onSuccess }: LocalDatabaseViewProps) {
  const [capabilities, setCapabilities] = useState<LocalDatabaseCapabilities | null>(null);
  const [databaseName, setDatabaseName] = useState("GemLife_Test.sqlite");
  const [profile, setProfile] = useState("gem-life-development");
  const [confirmed, setConfirmed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<LocalDatabaseCreationResult | null>(null);

  useEffect(() => {
    void api.getLocalDatabaseCapabilities().then(setCapabilities).catch(onError);
  }, [onError]);

  const selectedProfile = capabilities?.profiles.find((item) => item.id === profile) ?? capabilities?.profiles[0];

  async function createDatabase() {
    if (!selectedProfile) return;
    setCreating(true);
    setCreated(null);
    try {
      const result = await api.createLocalDatabase({
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

  return (
    <>
      <div className="content-heading">
        <div>
          <p className="eyebrow">Developer tools</p>
          <h2>Local Databases</h2>
          <p className="muted">Create an isolated SQLite database for development and testing. The personal Gem Life database is never a browser target.</p>
        </div>
        <span className={`record-count ${capabilities?.ready ? "ready" : ""}`}>{capabilities?.ready ? "Local creation ready" : "Creation disabled"}</span>
      </div>

      {!capabilities?.enabled || !capabilities.ready ? (
        <div className="empty-state"><div className="empty-icon">⌘</div><h3>Local creation is not enabled</h3><p>Set LOCAL_DATABASE_CREATION_ENABLED=true and point LOCAL_DATABASE_DIRECTORY at an existing safe folder before using this tool.</p></div>
      ) : (
        <div className="database-layout">
          <section className="database-panel">
            <div className="database-panel-heading"><div><p className="eyebrow">Safe creation</p><h3>New SQLite database</h3></div><span className="life-mark database-icon">＋</span></div>
            <label className="database-field">Database filename<input value={databaseName} onChange={(event) => setDatabaseName(event.target.value)} placeholder="GemLife_Test.sqlite" /></label>
            <label className="database-field">Migration profile<select value={profile} onChange={(event) => setProfile(event.target.value)}>{capabilities.profiles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="database-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I understand this creates a new file and will not replace an existing database.</label>
            <button className="primary-button" disabled={!confirmed || !databaseName.trim() || creating} onClick={() => void createDatabase()}>{creating ? "Creating database…" : "Create local database"}</button>
            {created ? <p className="database-result">Created <strong>{created.databaseName}</strong> and applied {created.migrationCount} migrations.</p> : null}
          </section>

          <section className="database-panel">
            <div className="database-panel-heading"><div><p className="eyebrow">Preview</p><h3>{selectedProfile?.name ?? "Migration profile"}</h3></div><span className="record-count">{selectedProfile?.migrations.length ?? 0} migrations</span></div>
            <ol className="migration-list">{selectedProfile?.migrations.map((migration) => <li key={migration}>{migration}</li>)}</ol>
            <div className="database-rules"><strong>Safety rules</strong>{capabilities.safetyRules.map((rule) => <p key={rule}>• {rule}</p>)}</div>
          </section>
        </div>
      )}
    </>
  );
}
