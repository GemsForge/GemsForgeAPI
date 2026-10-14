import { useMemo, useState } from "react";

/** Bound DOM work while preserving the API's existing list contract. */
export function usePagedRecords<T>(records: readonly T[], requestedSize = 50) {
  const pageSize = Number.isFinite(requestedSize) ? Math.max(1, Math.floor(requestedSize)) : 50;
  const [requestedPage, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(records.length / pageSize));
  const page = Math.min(Math.max(0, requestedPage), pageCount - 1);
  const items = useMemo(() => records.slice(page * pageSize, (page + 1) * pageSize), [records, page, pageSize]);
  return { items, page, pageSize, pageCount, total: records.length,
    previous: () => setPage(Math.max(0, page - 1)), next: () => setPage(Math.min(pageCount - 1, page + 1)) };
}
