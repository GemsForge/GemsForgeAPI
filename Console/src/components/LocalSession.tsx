import type { ReactNode } from "react";
import { useLocalSession } from "../hooks/useLocalSession";

export function LocalSession({ children }: { children: ReactNode }) {
  const session = useLocalSession();
  if (!session.active) return <main className="local-session-ended"><h1>Local workspace ended</h1><p>Cached records and unsaved drafts have been cleared. Your stored records were not deleted.</p><p>This is device-local access, not account sign-in.</p><button className="primary-button" onClick={session.resume}>Open local workspace</button></main>;
  return <>
    <section className="local-session-bar" aria-label="Device-local session">
      <div><strong>Device-local workspace</strong><p role="status">{session.health.isLoading ? "Checking local API…" : session.health.error ? "Local API unavailable" : "Local API available"}</p></div>
      {session.health.error && <button className="secondary-button" onClick={() => void session.health.refetch()}>Retry connection</button>}
      <button className="secondary-button" disabled={session.ending || session.pendingWrites > 0} onClick={() => void session.end()}>{session.ending ? "Ending…" : "End local session"}</button>
      {session.error && <p role="alert">{session.error}</p>}
    </section>
    <div key={session.generation}>{children}</div>
  </>;
}
