import { useState } from "react";
import { usePagedRecords } from "../../hooks/usePagedRecords";
import { PaginationControls } from "../../components/PaginationControls";
import { QueryFeedback } from "../../components/QueryFeedback";
import { AttachmentControl } from "../../components/AttachmentControl";
import { GemEmptyState, GemRecordCard, GemRecordList } from "../../components/ui";
import { useServiceAccountPatchMutation, useServiceAccountQuery } from "../../data/recordQueries";
import type { ServiceAccount } from "../../types";
import { RecordFields } from "../../components/RecordFields";
import { PropertyEditor } from "../../components/PropertyEditor";
import { useCreateServiceAccountMutation } from "../../data/recordQueries";
import { ServiceAccountCreateForm } from "../create/RecordCreateForms";

export function ServiceAccountsView({ records }: { records: ServiceAccount[] }) {
  const paging = usePagedRecords(records);
  const [selectedID, setSelectedID] = useState<number | null>(null);
  const detail = useServiceAccountQuery(selectedID);
  const patch = useServiceAccountPatchMutation();
  const [creating, setCreating] = useState(false);
  const create = useCreateServiceAccountMutation();
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
        </div>
      </div>
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
            getKey={(record) => String(record.id)}
            renderRecord={(record) => (
              <GemRecordCard
                className="address-card"
                icon="◎"
                title={record.service}
                subtitle={`${record.type || "Service"} · ${record.id}`}
                status={record.status || undefined}
                selected={selectedID === record.id}
                onSelect={() => setSelectedID(record.id)}
              />
            )}
          />
          <div>
            <QueryFeedback query={detail} />
            {detail.data ? (
              <ServiceAccountDetail
                key={detail.data.id}
                record={detail.data}
                onAttachment={async (metadata) => {
                  await patch.mutateAsync({
                    id: detail.data!.id,
                    patch: { logoFileMetadataID: metadata?.id ?? null },
                  });
                }}
                onPatch={async (values) => {
                  await patch.mutateAsync({ id: detail.data!.id, patch: values });
                }}
              />
            ) : (
              !selectedID && (
                <div className="detail-placeholder">
                  <span>◎</span>
                  <p>Select a service to view its details.</p>
                </div>
              )
            )}
          </div>
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
  return (
    <article className="address-detail">
      <div className="detail-heading">
        <div>
          <p className="eyebrow">Service account</p>
          <h3>{record.service}</h3>
          <p className="address-code">{record.id}</p>
        </div>
        <span className="status-pill">{record.status || "—"}</span>
      </div>
      <PropertyEditor
        label="Service"
        initialValue={record.service}
        editLabel="Edit service"
        saveLabel="Save service"
        required
        onSave={async (service) => onPatch({ service })}
      />
      <PropertyEditor
        label="Status"
        initialValue={record.status ?? ""}
        editLabel="Edit status"
        saveLabel="Save status"
        onSave={async (status) => onPatch({ status: status || null })}
      />
      <RecordFields
        className="address-fields"
        fields={[
          { label: "Type", value: record.type || "—" },
          { label: "Expense group", value: record.expenseGroup || "—" },
          { label: "Monthly amount", value: record.monthlyAmount === null ? "—" : String(record.monthlyAmount) },
          { label: "Payment method", value: record.paymentMethod || "—" },
          { label: "Website", value: record.website || "—" },
          { label: "Notes", value: record.notes || "—", className: "record-notes" },
        ]}
      />
      <AttachmentControl
        fileMetadataID={record.logoFileMetadataID}
        ownerType="ServiceAccount"
        ownerID={String(record.id)}
        label="Service logo"
        onAttach={onAttachment}
      />
    </article>
  );
}
