import { useEffect, useState } from "react";
import { usePagedRecords } from "../../hooks/usePagedRecords";
import { PaginationControls } from "../../components/PaginationControls";
import { QueryFeedback } from "../../components/QueryFeedback";
import { AttachmentControl } from "../../components/AttachmentControl";
import { GemEmptyState, GemRecordCard, GemRecordList } from "../../components/ui";
import { useServiceAccountPatchMutation, useServiceAccountQuery } from "../../data/recordQueries";
import type { ServiceAccount } from "../../types";
import {
  EditableRecordFields,
  formatRecordCurrency,
  formatRecordDate,
  formatRecordPercentage,
  formatRecordTimestamp,
} from "../../components/EditableRecordFields";
import { useCreateServiceAccountMutation } from "../../data/recordQueries";
import { ServiceAccountCreateForm } from "../create/RecordCreateForms";
import { RecordImport } from "../../components/RecordImport";
import { useServiceLogosQuery } from "../../data/lifeQueries";
import { RecordUtilities } from "../../components/RecordUtilities";
import { useRecordUtilities } from "../../hooks/useRecordUtilities";
import { api } from "../../api";

export function ServiceAccountsView({ records }: { records: ServiceAccount[] }) {
  const utilities = useRecordUtilities(records, (record) => [record.id, record.service, record.type, record.status, record.expenseGroup]);
  const paging = usePagedRecords(utilities.records);
  const [selectedID, setSelectedID] = useState<number | null>(null);
  const detail = useServiceAccountQuery(selectedID);
  const patch = useServiceAccountPatchMutation();
  const [creating, setCreating] = useState(false);
  const create = useCreateServiceAccountMutation();
  const logos = useServiceLogosQuery(true);
  return (
    <>
      <PaginationControls {...paging} label="Services" />
      <div className="content-heading">
        <div>
          <p className="eyebrow">Life-area records</p>
          <h2>Services</h2>
          <p className="muted">Recurring service accounts and their payment metadata.</p>
        </div>
        <div className="button-row">
          <span className="record-count">{records.length} records</span>
          <button type="button" onClick={() => setCreating(true)}>
            Add service
          </button>
          <RecordImport label="services" expectedColumns={["Service", "Type", "ExpenseGroup", "MonthlyAmount", "InterestRate", "APR", "Due", "Occurrence", "Status", "Since", "Website", "Notes", "PaymentMethod", "AccountNumber", "AssociatedAddress", "ServiceKey"]} onPublish={async (rows) => { for (const row of rows) await create.mutateAsync({
            service: String(row.Service ?? row.service ?? ""), type: String(row.Type ?? row.type ?? "") || null,
            expenseGroup: String(row.ExpenseGroup ?? "") || null, monthlyAmount: row.MonthlyAmount ? Number(row.MonthlyAmount) : null,
            interestRate: row.InterestRate ? Number(row.InterestRate) : null, apr: row.APR ? Number(row.APR) : null,
            due: String(row.Due ?? "") || null, occurrence: String(row.Occurrence ?? "") || null, status: String(row.Status ?? "") || null,
            since: String(row.Since ?? "") || null, website: String(row.Website ?? "") || null, notes: String(row.Notes ?? "") || null,
            paymentMethod: String(row.PaymentMethod ?? "") || null, accountNumber: String(row.AccountNumber ?? "") || null,
            associatedAddress: String(row.AssociatedAddress ?? "") || null, serviceKey: String(row.ServiceKey ?? "") || null,
          }); }} />
        </div>
      </div>
      <RecordUtilities label="Services" {...utilities} sortOptions={[]} />
      {creating && (
        <ServiceAccountCreateForm
          onCancel={() => setCreating(false)}
          onCreate={async (payload) => {
            const created = await create.mutateAsync(payload);
            setSelectedID(created.id);
            setCreating(false);
          }}
        />
      )}
      {records.length === 0 ? (
        <GemEmptyState
          icon="◎"
          title="No service accounts"
          description="The Services table did not return any records."
        />
      ) : (
        <div className="address-layout">
          <GemRecordList
            className="address-list"
            records={paging.items}
            label="Service account records"
            onExpandedChange={(key) => setSelectedID(key ? Number(key) : null)}
            getKey={(record) => String(record.id)}
            renderRecord={(record) => (
              <GemRecordCard
                className="address-card"
                icon={(() => {
                  const logo = logos.data?.find((item) => item.logoKey === record.logoKey);
                  return logo ? <LegacyLogoPreview logo={logo} className="service-account-card-logo" /> : "◎";
                })()}
                title={record.service}
                subtitle={`${record.type || "Service"} · ${record.id}`}
                status={record.status || undefined}
                selected={selectedID === record.id}
                onSelect={() => setSelectedID((current) => current === record.id ? null : record.id)}
              />
            )}
            isExpanded={(record) => selectedID === record.id}
            renderExpanded={() => (
              <>
                <QueryFeedback query={detail} />
                {detail.data && <ServiceAccountDetail
                  key={detail.data.id}
                  record={detail.data}
                  onAttachment={async (metadata) => {
                    await patch.mutateAsync({ id: detail.data!.id, patch: { logoFileMetadataID: metadata?.id ?? null } });
                  }}
                  onPatch={async (values) => {
                    await patch.mutateAsync({ id: detail.data!.id, patch: values });
                  }}
                />}
              </>
            )}
          />
        </div>
      )}
    </>
  );
}

function ServiceAccountDetail({
  record,
  onAttachment,
  onPatch,
}: {
  record: ServiceAccount;
  onAttachment: (metadata: import("../../types").FileMetadata | null) => Promise<void>;
  onPatch: (values: Partial<ServiceAccount>) => Promise<void>;
}) {
  const logos = useServiceLogosQuery(true);
  const legacyLogo = logos.data?.find((logo) => logo.logoKey === record.logoKey);
  return (
    <article className="address-detail">
      <EditableRecordFields
        className="address-fields"
        fields={[
          {
            label: "Service",
            value: record.service,
            required: true,
            onSave: async (value) => onPatch({ service: value as string }),
          },
          {
            label: "Type",
            value: record.type,
            inputType: "select",
            options: [
              { label: "Utility", value: "Utility" },
              { label: "Subscription", value: "Subscription" },
              { label: "Credit", value: "Credit" },
              { label: "Loan", value: "Loan" },
              { label: "Insurance", value: "Insurance" },
              { label: "Membership", value: "Membership" },
              { label: "Other", value: "Other" },
            ],
            nullable: true,
            onSave: async (value) => onPatch({ type: value as string | null }),
          },
          {
            label: "Expense group",
            value: record.expenseGroup,
            inputType: "select",
            options: [
              { label: "Fixed Bills (Obligations)", value: "Fixed Bills (Obligations)" },
              { label: "Variable Bills", value: "Variable Bills" },
              { label: "Home", value: "Home" },
              { label: "Lifestyle", value: "Lifestyle" },
              { label: "Other", value: "Other" },
            ],
            nullable: true,
            onSave: async (value) => onPatch({ expenseGroup: value as string | null }),
          },
          {
            label: "Monthly amount",
            value: record.monthlyAmount,
            inputType: "number",
            step: "0.01",
            nullable: true,
            displayValue: formatRecordCurrency(record.monthlyAmount),
            onSave: async (value) => onPatch({ monthlyAmount: value as number | null }),
          },
          {
            label: "Interest rate",
            value: record.interestRate,
            inputType: "number",
            step: "0.0001",
            nullable: true,
            displayValue: formatRecordPercentage(record.interestRate),
            onSave: async (value) => onPatch({ interestRate: value as number | null }),
          },
          {
            label: "APR",
            value: record.apr,
            inputType: "number",
            step: "0.0001",
            nullable: true,
            displayValue: formatRecordPercentage(record.apr),
            onSave: async (value) => onPatch({ apr: value as number | null }),
          },
          {
            label: "Due",
            value: record.due,
            nullable: true,
            onSave: async (value) => onPatch({ due: value as string | null }),
          },
          {
            label: "Occurrence",
            value: record.occurrence,
            nullable: true,
            onSave: async (value) => onPatch({ occurrence: value as string | null }),
          },
          {
            label: "Status",
            value: record.status,
            nullable: true,
            onSave: async (value) => onPatch({ status: value as string | null }),
          },
          {
            label: "Since",
            value: record.since,
            inputType: "date",
            nullable: true,
            displayValue: formatRecordDate(record.since),
            onSave: async (value) => onPatch({ since: value as string | null }),
          },
          {
            label: "Payment method",
            value: record.paymentMethod,
            nullable: true,
            onSave: async (value) => onPatch({ paymentMethod: value as string | null }),
          },
          {
            label: "Account number",
            value: record.accountNumber,
            nullable: true,
            onSave: async (value) => onPatch({ accountNumber: value as string | null }),
          },
          {
            label: "Service key",
            value: record.serviceKey,
            nullable: true,
            onSave: async (value) => onPatch({ serviceKey: value as string | null }),
          },
          {
            label: "Email updated",
            value: record.emailUpdated,
            inputType: "boolean",
            displayValue: record.emailUpdated ? "TRUE" : "FALSE",
            onSave: async (value) => onPatch({ emailUpdated: Boolean(value) }),
          },
          {
            label: "Website",
            value: record.website,
            inputType: "url",
            nullable: true,
            onSave: async (value) => onPatch({ website: value as string | null }),
          },
          {
            label: "Notion page",
            value: record.notionPage,
            inputType: "url",
            nullable: true,
            onSave: async (value) => onPatch({ notionPage: value as string | null }),
          },
          {
            label: "Notes",
            value: record.notes,
            inputType: "longText",
            nullable: true,
            className: "record-notes",
            onSave: async (value) => onPatch({ notes: value as string | null }),
          },
          {
            label: "Associated address",
            value: record.associatedAddress,
            readOnlyReason: "Legacy address value; no normalized, validated address selector is available.",
          },
          {
            label: "Last updated",
            value: record.updatedAt ?? null,
            readOnlyReason: "Server managed",
            displayValue: formatRecordTimestamp(record.updatedAt),
          },
        ]}
      />
      <AttachmentControl
        fileMetadataID={record.logoFileMetadataID ?? legacyLogo?.fileMetadataID}
        ownerType="ServiceAccount"
        ownerID={String(record.id)}
        label="Service logo"
        onAttach={onAttachment}
        className="service-logo-attachment"
      />
    </article>
  );
}

function LegacyLogoPreview({ logo, className }: { logo?: { id: number; logoKey: string | null; imagePath: string }; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!logo) return;
    let objectURL: string | undefined;
    const controller = new AbortController();
    void api.getServiceLogoImage(logo.id, controller.signal)
      .then((blob) => {
        objectURL = URL.createObjectURL(blob);
        setUrl(objectURL);
      })
      .catch(() => undefined);
    return () => {
      controller.abort();
      if (objectURL) URL.revokeObjectURL(objectURL);
    };
  }, [logo?.id]);
  if (!logo || !url) return null;
  return <img className={className ?? "service-logo-preview"} src={url} alt={`${logo.logoKey ?? "Service"} logo`} />;
}
