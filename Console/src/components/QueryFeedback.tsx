/** Only show loading before initial data; background refreshes retain the screen. */
export function QueryFeedback({
  query,
}: {
  query: { isLoading: boolean; error: Error | null; refetch: () => unknown };
}) {
  if (query.error)
    return (
      <div role="alert">
        <p>{query.error.message}</p>
        <button className="secondary-button" onClick={() => void query.refetch()}>
          Try again
        </button>
      </div>
    );
  if (query.isLoading) return <p role="status">Loading records…</p>;
  return null;
}
