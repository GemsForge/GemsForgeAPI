/** Shared address field options and validation used by create and edit flows. */
export const addressTypeOptions = ["Residence", "Storage", "Work", "School", "Other"].map((value) => ({
  value,
  label: value,
}));

/** Address lifecycle values presented by both create and edit controls. */
export const addressStatusOptions = ["Current", "Former", "Seasonal", "Other"].map((value) => ({
  value,
  label: value,
}));

/** Validate a browser date input without allowing JavaScript date normalization. */
export function isValidAddressDate(value: string): boolean {
  if (!value.trim()) return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const date = new Date(`${value.trim()}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() + 1 === Number(match[2]) &&
    date.getUTCDate() === Number(match[3])
  );
}

/** Accept international city, state, and region names. */
export function isValidAddressLocation(value: string): boolean {
  return !value.trim() || /^[\p{L}\p{M}0-9 .,'’&()/-]+$/u.test(value.trim());
}

/** Accept common domestic and international postal-code characters. */
export function isValidAddressPostalCode(value: string): boolean {
  return !value.trim() || /^[\p{L}\p{N}][\p{L}\p{N} .-]*$/u.test(value.trim());
}
