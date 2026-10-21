import { RecordCollection } from "../../table-kit/RecordCollection";
import type { RecordCollectionProps } from "../../table-kit/RecordCollection";

/** Compatibility-named adapter for the shared Table Kit record collection. */
export function GemRecordList<Record>(props: RecordCollectionProps<Record>) {
  return <RecordCollection {...props} />;
}

export type { RecordCollectionProps as GemRecordListProps } from "../../table-kit/RecordCollection";
