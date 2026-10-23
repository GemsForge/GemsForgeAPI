import { Select } from "tamagui";

interface Props {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  previous: () => void;
  next: () => void;
  setPageSize: (size: number) => void;
  label: string;
}
export function PaginationControls({ page, pageCount, total, pageSize, previous, next, setPageSize, label }: Props) {
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
      <label>
        Records per page
        <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
          <Select.Trigger aria-label="Records per page" size="$3" width={82}>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Viewport minWidth={82}>
              {[6, 12, 18, 24, 30].map((size) => (
                <Select.Item key={size} value={String(size)}>
                  <Select.ItemText>{size}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select>
      </label>
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
