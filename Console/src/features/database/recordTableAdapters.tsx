import type { ReactNode } from "react";
import type { Address, Education, Employment, ExpenseTransaction, GemHue, ServiceAccount } from "../../types";
import type { RecordAdapter, RecordImage, RecordPropertyDefinition } from "../../table-kit";

const display = (value: unknown) => ({ raw: value, display: value == null || value === "" ? "—" : String(value) });
const currency = (value: number | null | undefined) => ({
  raw: value,
  display: value == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value),
});
const hueOptions = ["Red", "Orange", "Yellow", "Green", "Blue", "Purple", "Pink", "Brown", "Gray", "Black", "White"].map(
  (value) => ({ value, label: value }),
);

/** Adapt Gem Hue records to the shared Table Kit record/property contract. */
export function createGemHueTableAdapter(
  getImage?: (record: GemHue) => RecordImage | undefined,
  onSave?: (record: GemHue, field: keyof GemHue, value: string | number | null) => Promise<void>,
): RecordAdapter<GemHue> {
  return {
    toTableRecord: (record) => ({
      id: record.id,
      source: record,
      title: record.colorName,
      subtitle: `${record.hexCode} · ${record.colorFamily || "Unclassified"}`,
      icon: "✦",
      image: getImage?.(record),
      titleEdit: onSave ? { onSave: (_record, value) => onSave(record, "colorName", value) } : undefined,
    }),
    getPropertyDefinitions: () =>
      [
        {
          id: "colorName",
          label: "Color name",
          kind: "text",
          primary: true,
          getValue: (record) => display(record.colorName),
          edit: onSave ? { onSave: (record, value) => onSave(record as GemHue, "colorName", value) } : undefined,
        },
        { id: "colorFamily", label: "Color family", kind: "select", getValue: (record) => display(record.colorFamily), edit: onSave ? { inputType: "select", options: hueOptions, onSave: (record, value) => onSave(record as GemHue, "colorFamily", value) } : undefined },
        { id: "hexCode", label: "Hex code", kind: "text", getValue: (record) => display(record.hexCode), edit: onSave ? { onSave: (record, value) => onSave(record as GemHue, "hexCode", value) } : undefined },
        { id: "mood", label: "Mood", kind: "select", getValue: (record) => display(record.mood), edit: onSave ? { inputType: "select", options: hueOptions, onSave: (record, value) => onSave(record as GemHue, "mood", value) } : undefined },
        { id: "palette", label: "Palette", kind: "select", getValue: (record) => display(record.palette), edit: onSave ? { inputType: "select", options: hueOptions, onSave: (record, value) => onSave(record as GemHue, "palette", value) } : undefined },
        { id: "description", label: "Description", kind: "text", getValue: (record) => display(record.description), edit: onSave ? { inputType: "longText", onSave: (record, value) => onSave(record as GemHue, "description", value) } : undefined },
        { id: "createdDate", label: "Created date", kind: "date", getValue: (record) => display(record.createdDate) },
        { id: "notes", label: "Notes", kind: "text", getValue: (record) => display(record.notes) },
        { id: "id", label: "Item ID", kind: "text", getValue: (record) => display(record.id) },
      ] satisfies readonly RecordPropertyDefinition<GemHue>[],
  };
}

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
      { id: "addressType", label: "Address type", kind: "select", getValue: (record) => display(record.addressType) },
      { id: "addressLine1", label: "Address line 1", kind: "text", getValue: (record) => display(record.addressLine1) },
      { id: "addressLine2", label: "Address line 2", kind: "text", getValue: (record) => display(record.addressLine2) },
      { id: "state", label: "State", kind: "text", getValue: (record) => display(record.state) },
      { id: "postalCode", label: "Postal code", kind: "text", getValue: (record) => display(record.postalCode) },
      { id: "country", label: "Country", kind: "text", getValue: (record) => display(record.country) },
      { id: "startDate", label: "Start date", kind: "date", getValue: (record) => display(record.startDate) },
      { id: "endDate", label: "End date", kind: "date", getValue: (record) => display(record.endDate) },
      { id: "addressStatus", label: "Status", kind: "status", getValue: (record) => display(record.addressStatus) },
      { id: "notes", label: "Notes", kind: "text", getValue: (record) => display(record.notes) },
      {
        id: "imageFileMetadataID",
        label: "Image file",
        kind: "text",
        getValue: (record) => display(record.imageFileMetadataID),
      },
      { id: "updatedAt", label: "Last updated", kind: "date", getValue: (record) => display(record.updatedAt) },
      { id: "id", label: "Item ID", kind: "text", getValue: (record) => display(record.id) },
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
      {
        id: "educationType",
        label: "Education type",
        kind: "select",
        getValue: (record) => display(record.educationType),
      },
      { id: "program", label: "Program", kind: "text", getValue: (record) => display(record.program) },
      { id: "fieldOfStudy", label: "Field of study", kind: "text", getValue: (record) => display(record.fieldOfStudy) },
      { id: "credential", label: "Credential", kind: "text", getValue: (record) => display(record.credential) },
      { id: "credentialID", label: "Credential ID", kind: "text", getValue: (record) => display(record.credentialID) },
      { id: "startDate", label: "Start date", kind: "date", getValue: (record) => display(record.startDate) },
      { id: "endDate", label: "End date", kind: "date", getValue: (record) => display(record.endDate) },
      { id: "awardedDate", label: "Awarded date", kind: "date", getValue: (record) => display(record.awardedDate) },
      { id: "educationStatus", label: "Status", kind: "status", getValue: (record) => display(record.status) },
      {
        id: "locationAddressID",
        label: "Location address",
        kind: "text",
        getValue: (record) => display(record.locationAddressID),
      },
      { id: "website", label: "Website", kind: "text", getValue: (record) => display(record.website) },
      { id: "notes", label: "Notes", kind: "text", getValue: (record) => display(record.notes) },
      {
        id: "documentFileMetadataID",
        label: "Document file",
        kind: "text",
        getValue: (record) => display(record.documentFileMetadataID),
      },
      { id: "updatedAt", label: "Last updated", kind: "date", getValue: (record) => display(record.updatedAt) },
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
      {
        id: "employerType",
        label: "Employer type",
        kind: "select",
        getValue: (record) => display(record.employerType),
      },
      { id: "industry", label: "Industry", kind: "text", getValue: (record) => display(record.industry) },
      { id: "position", label: "Position", kind: "text", getValue: (record) => display(record.positionTitle) },
      {
        id: "employmentType",
        label: "Employment type",
        kind: "select",
        getValue: (record) => display(record.employmentType),
      },
      { id: "startDate", label: "Start date", kind: "date", getValue: (record) => display(record.startDate) },
      { id: "endDate", label: "End date", kind: "date", getValue: (record) => display(record.endDate) },
      { id: "workAddressID", label: "Work address", kind: "text", getValue: (record) => display(record.workAddressID) },
      { id: "website", label: "Website", kind: "text", getValue: (record) => display(record.website) },
      { id: "employerContact", label: "Contact", kind: "text", getValue: (record) => display(record.employerContact) },
      {
        id: "employerContactNumber",
        label: "Contact number",
        kind: "text",
        getValue: (record) => display(record.employerContactNumber),
      },
      {
        id: "employerContactEmail",
        label: "Contact email",
        kind: "text",
        getValue: (record) => display(record.employerContactEmail),
      },
      { id: "notes", label: "Notes", kind: "text", getValue: (record) => display(record.notes) },
      { id: "updatedAt", label: "Last updated", kind: "date", getValue: (record) => display(record.updatedAt) },
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
      { id: "receiptID", label: "Receipt ID", kind: "text", getValue: (record) => display(record.receiptID) },
      {
        id: "firstReceiptItem",
        label: "First receipt item",
        kind: "status",
        getValue: (record) => display(record.firstReceiptItem),
      },
      { id: "category", label: "Category", kind: "number", getValue: (record) => display(record.categoryID) },
      { id: "id", label: "Item ID", kind: "text", getValue: (record) => display(record.id) },
      { id: "date", label: "Date", kind: "date", getValue: (record) => display(record.transactionDate) },
      {
        id: "subcategoryID",
        label: "Subcategory",
        kind: "number",
        getValue: (record) => display(record.subcategoryID),
      },
      { id: "merchantCode", label: "Merchant code", kind: "text", getValue: (record) => display(record.merchantCode) },
      { id: "quantity", label: "Quantity", kind: "number", getValue: (record) => display(record.quantity) },
      {
        id: "regularPrice",
        label: "Regular price",
        kind: "number",
        getValue: (record) => currency(record.regularPrice),
      },
      { id: "paidPrice", label: "Paid price", kind: "number", getValue: (record) => currency(record.paidPrice) },
      { id: "total", label: "Total", kind: "number", getValue: (record) => currency(record.total) },
      { id: "discount", label: "Discount", kind: "number", getValue: (record) => currency(record.discount) },
      { id: "notes", label: "Notes", kind: "text", getValue: (record) => display(record.notes) },
      { id: "image", label: "Image", kind: "image", getValue: (record) => display(record.image) },
      { id: "updatedAt", label: "Last updated", kind: "date", getValue: (record) => display(record.updatedAt) },
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
        { id: "status", label: "Status", kind: "status", getValue: (record) => display(record.status) },
        { id: "type", label: "Category", kind: "select", getValue: (record) => display(record.type || "Service") },
        { id: "id", label: "Item ID", kind: "number", getValue: (record) => display(record.id) },
        { id: "group", label: "Group", kind: "text", getValue: (record) => display(record.expenseGroup) },
        { id: "logoKey", label: "Logo key", kind: "text", getValue: (record) => display(record.logoKey) },
        {
          id: "monthlyAmount",
          label: "Monthly amount",
          kind: "number",
          getValue: (record) => currency(record.monthlyAmount),
        },
        {
          id: "interestRate",
          label: "Interest rate",
          kind: "number",
          getValue: (record) => display(record.interestRate),
        },
        { id: "apr", label: "APR", kind: "number", getValue: (record) => display(record.apr) },
        { id: "due", label: "Due", kind: "text", getValue: (record) => display(record.due) },
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
          kind: "status",
          getValue: (record) => display(record.emailUpdated),
        },
        {
          id: "associatedAddress",
          label: "Associated address",
          kind: "text",
          getValue: (record) => display(record.associatedAddress),
        },
        { id: "serviceKey", label: "Service key", kind: "text", getValue: (record) => display(record.serviceKey) },
        {
          id: "logoFileMetadataID",
          label: "Logo file",
          kind: "text",
          getValue: (record) => display(record.logoFileMetadataID),
        },
        { id: "updatedAt", label: "Last updated", kind: "date", getValue: (record) => display(record.updatedAt) },
      ] satisfies readonly RecordPropertyDefinition<ServiceAccount>[],
  };
}

function formatAmount(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
