import { useState } from "react";
import { usePagedRecords } from "../../hooks/usePagedRecords";
import { PaginationControls } from "../../components/PaginationControls";
import { QueryFeedback } from "../../components/QueryFeedback";
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
  onPatch,
}: {
  record: ServiceAccount;
  onPatch: (values: Partial<ServiceAccount>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [service, setService] = useState(record.service);
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
            await onPatch({ service });
            setEditing(false);
          }}
        >
          <label>
            Service
            <input value={service} onChange={(event) => setService(event.target.value)} required />
          </label>
          <button type="submit">Save service</button>
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
      <dl className="address-fields">
        <Field label="Type" value={record.type} />
        <Field label="Expense group" value={record.expenseGroup} />
        <Field label="Monthly amount" value={record.monthlyAmount === null ? null : String(record.monthlyAmount)} />
        <Field label="Payment method" value={record.paymentMethod} />
        <Field label="Website" value={record.website} />
        <Field label="Notes" value={record.notes} />
      </dl>
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
