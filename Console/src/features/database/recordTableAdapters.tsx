import type { ReactNode } from "react";
import type { Address, Education, Employment, ExpenseTransaction, ServiceAccount } from "../../types";
import type { RecordAdapter, RecordImage, RecordPropertyDefinition } from "../../table-kit";

const display = (value: unknown) => ({ raw: value, display: value == null || value === "" ? "—" : String(value) });

/** Shared adapter for address records; the detail surface remains feature-owned. */
export const addressTableAdapter: RecordAdapter<Address> = {
  toTableRecord: (record) => ({
    id: record.id,
    source: record,
    title: record.city || record.addressType,
    subtitle: `${record.addressType} · ${record.id}`,
    icon: "⌂",
    status: { label: record.addressStatus },
  }),
  getPropertyDefinitions: () =>
    [
      { id: "city", label: "City", kind: "text", primary: true, getValue: (record) => display(record.city) },
      { id: "type", label: "Category", kind: "select", getValue: (record) => display(record.addressType) },
      { id: "id", label: "Item ID", kind: "text", getValue: (record) => display(record.id) },
      { id: "status", label: "Status", kind: "status", getValue: (record) => display(record.addressStatus) },
    ] satisfies readonly RecordPropertyDefinition<Address>[],
};

/** Shared adapter for education records. */
export const educationTableAdapter: RecordAdapter<Education> = {
  toTableRecord: (record) => ({
    id: record.id,
    source: record,
    title: record.institutionName,
    subtitle: `${record.educationType} · ${record.id}`,
    icon: "✦",
    status: { label: record.status },
  }),
  getPropertyDefinitions: () =>
    [
      {
        id: "institution",
        label: "Institution",
        kind: "text",
        primary: true,
        getValue: (record) => display(record.institutionName),
      },
      { id: "type", label: "Category", kind: "select", getValue: (record) => display(record.educationType) },
      { id: "id", label: "Item ID", kind: "text", getValue: (record) => display(record.id) },
      { id: "status", label: "Status", kind: "status", getValue: (record) => display(record.status) },
    ] satisfies readonly RecordPropertyDefinition<Education>[],
};

/** Shared adapter for employment records. */
export const employmentTableAdapter: RecordAdapter<Employment> = {
  toTableRecord: (record) => ({
    id: record.id,
    source: record,
    title: record.employerName,
    subtitle: `${record.positionTitle} · ${record.id}`,
    icon: "✦",
    status: { label: record.employmentStatus },
  }),
  getPropertyDefinitions: () =>
    [
      {
        id: "employer",
        label: "Employer",
        kind: "text",
        primary: true,
        getValue: (record) => display(record.employerName),
      },
      { id: "position", label: "Position", kind: "text", getValue: (record) => display(record.positionTitle) },
      { id: "id", label: "Item ID", kind: "text", getValue: (record) => display(record.id) },
      { id: "status", label: "Status", kind: "status", getValue: (record) => display(record.employmentStatus) },
    ] satisfies readonly RecordPropertyDefinition<Employment>[],
};

/** Shared adapter for expense transaction records. */
export const transactionTableAdapter: RecordAdapter<ExpenseTransaction> = {
  toTableRecord: (record) => ({
    id: record.id,
    source: record,
    title: record.item,
    subtitle: `${record.transactionDate || "Undated"} · ${record.id}`,
    icon: "$",
    status: { label: formatAmount(record.total ?? record.paidPrice) },
  }),
  getPropertyDefinitions: () =>
    [
      { id: "item", label: "Item", kind: "text", primary: true, getValue: (record) => display(record.item) },
      { id: "category", label: "Category", kind: "number", getValue: (record) => display(record.categoryID) },
      { id: "id", label: "Item ID", kind: "text", getValue: (record) => display(record.id) },
      { id: "date", label: "Date", kind: "date", getValue: (record) => display(record.transactionDate) },
    ] satisfies readonly RecordPropertyDefinition<ExpenseTransaction>[],
};

/** Create the service adapter while retaining the existing logo lookup and preview behavior. */
export function createServiceAccountTableAdapter(
  renderLogo: (record: ServiceAccount) => ReactNode,
  getLogoImage?: (record: ServiceAccount) => RecordImage | undefined,
): RecordAdapter<ServiceAccount> {
  return {
    toTableRecord: (record) => ({
      id: String(record.id),
      source: record,
      title: record.service,
      subtitle: `${record.type || "Service"} · ${record.id}`,
      icon: "◎",
      image: getLogoImage?.(record),
      status: record.status ? { label: record.status } : undefined,
    }),
    getPropertyDefinitions: () =>
      [
        { id: "logo", label: "Logo", kind: "image", getValue: (record) => ({ display: renderLogo(record) }) },
        { id: "service", label: "Service", kind: "text", primary: true, getValue: (record) => display(record.service) },
        { id: "type", label: "Category", kind: "select", getValue: (record) => display(record.type || "Service") },
        { id: "id", label: "Item ID", kind: "number", getValue: (record) => display(record.id) },
        { id: "group", label: "Group", kind: "text", getValue: (record) => display(record.expenseGroup) },
      ] satisfies readonly RecordPropertyDefinition<ServiceAccount>[],
  };
}

function formatAmount(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
