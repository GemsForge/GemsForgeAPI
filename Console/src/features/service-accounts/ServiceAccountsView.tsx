import { useState } from "react";
import { usePagedRecords } from "../../hooks/usePagedRecords";
import { PaginationControls } from "../../components/PaginationControls";
import { QueryFeedback } from "../../components/QueryFeedback";
import { AttachmentControl } from "../../components/AttachmentControl";
import { GemEmptyState, GemRecordCard, GemRecordList } from "../../components/ui";
import { useServiceAccountPatchMutation, useServiceAccountQuery } from "../../data/recordQueries";
import type { ServiceAccount } from "../../types";

export function ServiceAccountsView({ records }: { records: ServiceAccount[] }) {
  const paging = usePagedRecords(records);
  const [selectedID, setSelectedID] = useState<number | null>(null);
  const detail = useServiceAccountQuery(selectedID);
  const patch = useServiceAccountPatchMutation();
  return (
    <>
      <PaginationControls {...paging} label="Services" />
      <div className="content-heading">
        <div>
          <p className="eyebrow">Life-area records</p>
          <h2>Services</h2>
          <p className="muted">Recurring service accounts and their payment metadata.</p>
        </div>
        <span className="record-count">{records.length} records</span>
      </div>
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
                saving={patch.isPending}
                error={patch.error}
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
  saving,
  error,
  onAttachment,
  onPatch,
}: {
  record: ServiceAccount;
  saving: boolean;
  error: Error | null;
  onAttachment: (metadata: import("../../types").FileMetadata | null) => Promise<void>;
  onPatch: (values: Partial<ServiceAccount>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [service, setService] = useState(record.service);
  const [editingStatus, setEditingStatus] = useState(false);
  const [status, setStatus] = useState(record.status ?? "");
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
      {editing ? (
        <form
          className="edit-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (service === record.service) {
              setEditing(false);
              return;
            }
            await onPatch({ service });
            setEditing(false);
          }}
        >
          <label>
            Service
            <input value={service} onChange={(event) => setService(event.target.value)} required />
          </label>
          {error && <p role="alert">{error.message} Try again.</p>}
          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save service"}
          </button>
          <button
            type="button"
            onClick={() => {
              setService(record.service);
              setEditing(false);
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setEditing(true)}>
          Edit service
        </button>
      )}
      {editingStatus ? (
        <form
          className="edit-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (status === (record.status ?? "")) {
              setEditingStatus(false);
              return;
            }
            await onPatch({ status: status || null });
            setEditingStatus(false);
          }}
        >
          <label>
            Status
            <input value={status} onChange={(event) => setStatus(event.target.value)} />
          </label>
          {error && <p role="alert">{error.message} Try again.</p>}
          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save status"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStatus(record.status ?? "");
              setEditingStatus(false);
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setEditingStatus(true)}>
          Edit status
        </button>
      )}
      <dl className="address-fields">
        <Field label="Type" value={record.type} />
        <Field label="Expense group" value={record.expenseGroup} />
        <Field label="Monthly amount" value={record.monthlyAmount === null ? null : String(record.monthlyAmount)} />
        <Field label="Payment method" value={record.paymentMethod} />
        <Field label="Website" value={record.website} />
        <Field label="Notes" value={record.notes} />
      </dl>
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

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}
