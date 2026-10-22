import type { ReactNode } from "react";
import type { Address, Education, Employment, ExpenseTransaction, GemHue, ServiceAccount } from "../../types";
import type { RecordAdapter, RecordPropertyDefinition } from "../../table-kit";
import { api } from "../../api";

const display = (value: unknown) => ({ raw: value, display: value == null || value === "" ? "—" : String(value) });
const recordImage = (fileMetadataID: string | null | undefined, alt: string) =>
  fileMetadataID ? { src: api.fileContentURL(fileMetadataID), alt, fit: "cover" as const } : undefined;

/** Shared adapter for address records; the detail surface remains feature-owned. */
export const addressTableAdapter: RecordAdapter<Address> = {
  toTableRecord: (record) => ({
    id: record.id,
    source: record,
    title: record.city || record.addressType,
    subtitle: `${record.addressType} · ${record.id}`,
    status: { label: record.addressStatus },
    image: recordImage(record.imageFileMetadataID, `${record.addressType} address`),
  }),
  getPropertyDefinitions: () =>
    [
      { id: "city", label: "City", kind: "text", primary: true, getValue: (record) => display(record.city) },
      { id: "addressLine1", label: "Address line 1", kind: "text", getValue: (record) => display(record.addressLine1) },
      { id: "addressLine2", label: "Address line 2", kind: "text", getValue: (record) => display(record.addressLine2) },
      { id: "type", label: "Category", kind: "select", getValue: (record) => display(record.addressType) },
      { id: "state", label: "State / region", kind: "text", getValue: (record) => display(record.state) },
      { id: "postalCode", label: "Postal code", kind: "text", getValue: (record) => display(record.postalCode) },
      { id: "country", label: "Country", kind: "text", getValue: (record) => display(record.country) },
      { id: "startDate", label: "Start date", kind: "date", getValue: (record) => display(record.startDate) },
      { id: "endDate", label: "End date", kind: "date", getValue: (record) => display(record.endDate) },
      { id: "id", label: "Item ID", kind: "text", getValue: (record) => display(record.id) },
      { id: "status", label: "Status", kind: "status", getValue: (record) => display(record.addressStatus) },
      { id: "notes", label: "Notes", kind: "text", getValue: (record) => display(record.notes) },
    ] satisfies readonly RecordPropertyDefinition<Address>[],
};

/** Shared adapter for education records. */
export const educationTableAdapter: RecordAdapter<Education> = {
  toTableRecord: (record) => ({
    id: record.id,
    source: record,
    title: record.institutionName,
    subtitle: `${record.educationType} · ${record.id}`,
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
    status: { label: formatAmount(record.total ?? record.paidPrice) },
    image: recordImage(record.image, `${record.item} receipt`),
  }),
  getPropertyDefinitions: () =>
    [
      { id: "item", label: "Item", kind: "text", primary: true, getValue: (record) => display(record.item) },
      { id: "category", label: "Category", kind: "number", getValue: (record) => display(record.categoryID) },
      { id: "id", label: "Item ID", kind: "text", getValue: (record) => display(record.id) },
      { id: "date", label: "Date", kind: "date", getValue: (record) => display(record.transactionDate) },
    ] satisfies readonly RecordPropertyDefinition<ExpenseTransaction>[],
};

/** Shared adapter for Gem Hue records so the foundation table uses every Table Kit view. */
export const gemHueTableAdapter: RecordAdapter<GemHue> = {
  toTableRecord: (record) => ({
    id: record.id,
    source: record,
    title: record.colorName,
    subtitle: `${record.hexCode} · ${record.id}`,
    image: { src: api.gemHueImageURL(record.id), alt: `${record.colorName} reference`, fit: "contain" },
    status: record.colorFamily ? { label: record.colorFamily } : undefined,
  }),
  getPropertyDefinitions: () =>
    [
      {
        id: "colorName",
        label: "Color name",
        kind: "text",
        primary: true,
        getValue: (record) => display(record.colorName),
      },
      { id: "hexCode", label: "Hex code", kind: "text", getValue: (record) => display(record.hexCode) },
      { id: "colorFamily", label: "Color family", kind: "select", getValue: (record) => display(record.colorFamily) },
      { id: "mood", label: "Mood", kind: "select", getValue: (record) => display(record.mood) },
      { id: "palette", label: "Palette", kind: "select", getValue: (record) => display(record.palette) },
      { id: "description", label: "Description", kind: "text", getValue: (record) => display(record.description) },
      { id: "createdDate", label: "Created date", kind: "date", getValue: (record) => display(record.createdDate) },
      { id: "notes", label: "Notes", kind: "text", getValue: (record) => display(record.notes) },
      { id: "id", label: "Item ID", kind: "text", getValue: (record) => display(record.id) },
    ] satisfies readonly RecordPropertyDefinition<GemHue>[],
};

/** Create the service adapter while retaining the existing logo lookup and preview behavior. */
export function createServiceAccountTableAdapter(
  renderLogo: (record: ServiceAccount) => ReactNode,
  getLogoImageURL?: (record: ServiceAccount) => string | undefined,
): RecordAdapter<ServiceAccount> {
  return {
    toTableRecord: (record) => ({
      id: String(record.id),
      source: record,
      title: record.service,
      subtitle: `${record.type || "Service"} · ${record.id}`,
      image: getLogoImageURL?.(record)
        ? { src: getLogoImageURL(record)!, alt: `${record.service} logo`, fit: "contain" }
        : recordImage(record.logoFileMetadataID, `${record.service} logo`),
      status: record.status ? { label: record.status } : undefined,
    }),
    getPropertyDefinitions: () =>
      [
        { id: "logo", label: "Logo", kind: "image", getValue: (record) => ({ display: renderLogo(record) }) },
        { id: "service", label: "Service", kind: "text", primary: true, getValue: (record) => display(record.service) },
        { id: "type", label: "Category", kind: "select", getValue: (record) => display(record.type || "Service") },
        { id: "id", label: "Item ID", kind: "number", getValue: (record) => display(record.id) },
        { id: "group", label: "Group", kind: "text", getValue: (record) => display(record.expenseGroup) },
        {
          id: "monthlyAmount",
          label: "Monthly amount",
          kind: "number",
          getValue: (record) => display(formatAmount(record.monthlyAmount)),
        },
        {
          id: "interestRate",
          label: "Interest rate",
          kind: "number",
          getValue: (record) => display(record.interestRate),
        },
        { id: "apr", label: "APR", kind: "number", getValue: (record) => display(record.apr) },
        { id: "due", label: "Due date", kind: "date", getValue: (record) => display(record.due) },
        { id: "occurrence", label: "Occurrence", kind: "text", getValue: (record) => display(record.occurrence) },
        { id: "since", label: "Since", kind: "date", getValue: (record) => display(record.since) },
        { id: "website", label: "Website", kind: "text", getValue: (record) => display(record.website) },
        { id: "notes", label: "Notes", kind: "text", getValue: (record) => display(record.notes) },
        { id: "notionPage", label: "Notion page", kind: "text", getValue: (record) => display(record.notionPage) },
        {
          id: "paymentMethod",
          label: "Payment method",
          kind: "text",
          getValue: (record) => display(record.paymentMethod),
        },
        {
          id: "accountNumber",
          label: "Account number",
          kind: "text",
          getValue: (record) => display(record.accountNumber),
        },
        {
          id: "emailUpdated",
          label: "Email updated",
          kind: "select",
          getValue: (record) => display(record.emailUpdated),
        },
        {
          id: "associatedAddress",
          label: "Associated address",
          kind: "relation",
          getValue: (record) => display(record.associatedAddress),
        },
        { id: "serviceKey", label: "Service key", kind: "text", getValue: (record) => display(record.serviceKey) },
        { id: "logoKey", label: "Logo key", kind: "text", getValue: (record) => display(record.logoKey) },
        {
          id: "logoFileMetadataID",
          label: "Logo file",
          kind: "relation",
          getValue: (record) => display(record.logoFileMetadataID),
        },
        { id: "updatedAt", label: "Last updated", kind: "date", getValue: (record) => display(record.updatedAt) },
      ] satisfies readonly RecordPropertyDefinition<ServiceAccount>[],
  };
}

function formatAmount(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
