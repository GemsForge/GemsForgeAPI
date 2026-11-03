import type { RecordSelectOption } from "../table-kit/recordContracts";

/** Keep an existing value visible when legacy data is absent from the current option set. */
export function withCurrentRecordOption(
  options: readonly RecordSelectOption[],
  current: string | number | null | undefined,
): RecordSelectOption[] {
  if (current === null || current === undefined || current === "") return [...options];
  const value = String(current);
  return options.some((option) => option.value === value)
    ? [...options]
    : [...options, { value, label: value }];
}
