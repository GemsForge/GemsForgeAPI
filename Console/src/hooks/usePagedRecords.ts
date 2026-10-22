import { useEffect, useMemo, useState } from "react";

/** Bound DOM work while preserving the API's existing list contract. */
export function usePagedRecords<T>(records: readonly T[], requestedSize = 12) {
  const initialPageSize = Number.isFinite(requestedSize) ? Math.max(1, Math.floor(requestedSize)) : 12;
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [requestedPage, setPage] = useState(0);
  // Keep a filtered/sorted result on its first page when its size changes.
  useEffect(() => setPage(0), [records]);
  const pageCount = Math.max(1, Math.ceil(records.length / pageSize));
  const page = Math.min(Math.max(0, requestedPage), pageCount - 1);
  const items = useMemo(() => records.slice(page * pageSize, (page + 1) * pageSize), [records, page, pageSize]);
  /** Change the visible page size and return the user to the first page. */
  const setPageSize = (nextPageSize: number) => {
    if (!Number.isFinite(nextPageSize)) return;
    setPageSizeState(Math.max(1, Math.floor(nextPageSize)));
    setPage(0);
  };
  return {
    items,
    page,
    pageSize,
    setPageSize,
    pageCount,
    total: records.length,
    previous: () => setPage(Math.max(0, page - 1)),
    next: () => setPage(Math.min(pageCount - 1, page + 1)),
  };
}
