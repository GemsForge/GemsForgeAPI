import { presentError } from "./errorPresentation";

/** Only show loading before initial data; background refreshes retain the screen. */
export function QueryFeedback({
  query,
}: {
  query: { isLoading: boolean; error: Error | null; refetch: () => unknown };
}) {
  if (query.error) {
    const feedback = presentError(query.error);
    return (
      <div role="alert">
        <p>{feedback.message}</p>
        {feedback.canRetry && (
          <button className="secondary-button" onClick={() => void query.refetch()}>
            Try again
          </button>
        )}
      </div>
    );
  }
  if (query.isLoading) return <p role="status">Loading records…</p>;
  return null;
}
