interface Props {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  previous: () => void;
  next: () => void;
  label: string;
}
export function PaginationControls({ page, pageCount, total, pageSize, previous, next, label }: Props) {
  if (pageCount <= 1) return null;
  return (
    <nav className="pagination-controls" aria-label={`${label} pages`}>
      <button
        className="secondary-button"
        aria-label={`Previous page of ${label}`}
        onClick={previous}
        disabled={page === 0}
      >
        Previous
      </button>
      <span role="status">
        {page * pageSize + 1}–{Math.min(total, (page + 1) * pageSize)} of {total}
      </span>
      <button
        className="secondary-button"
        aria-label={`Next page of ${label}`}
        onClick={next}
        disabled={page === pageCount - 1}
      >
        Next
      </button>
    </nav>
  );
}
