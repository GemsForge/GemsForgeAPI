import { usePagedRecords } from "../../hooks/usePagedRecords";
import { PaginationControls } from "../../components/PaginationControls";
import { useState } from "react";
import { useEmploymentPatchMutation, useEmploymentRecordQuery } from "../../data/recordQueries";
import { QueryFeedback } from "../../components/QueryFeedback";
import type { Employment } from "../../types";
import { GemEmptyState, GemRecordCard, GemRecordList } from "../../components/ui";
import { useCreateEmploymentMutation } from "../../data/recordQueries";
import { useAddressesQuery } from "../../data/lifeQueries";
import { EmploymentCreateForm } from "../create/RecordCreateForms";

interface EmploymentViewProps {
  records: Employment[];
}

export function EmploymentView({ records }: EmploymentViewProps) {
  const paging = usePagedRecords(records);
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const detail = useEmploymentRecordQuery(selectedID);
  const patch = useEmploymentPatchMutation();
  const selectedRecord = detail.data;
  const [creating, setCreating] = useState(false);
  const create = useCreateEmploymentMutation();
  const addresses = useAddressesQuery(creating);

  return (
    <>
      <PaginationControls {...paging} label="Employment" />
      <div className="content-heading">
        <div>
          <p className="eyebrow">Life-area records</p>
          <h2>Employment</h2>
          <p className="muted">
            Read employment history from the existing Gem Life database. These records are not assigned to a Domain.
          </p>
        </div>
        <div className="button-row">
          <span className="record-count">{records.length} records</span>
          <button type="button" onClick={() => setCreating(true)}>
            Add employment
          </button>
        </div>
      </div>

      {creating && (
        <EmploymentCreateForm
          addresses={addresses.data ?? []}
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
          icon="✦"
          title="No employment records"
          description="The Employment table did not return any records."
        />
      ) : (
        <div className="employment-layout">
          <GemRecordList
            className="employment-list"
            records={paging.items}
            label="Employment records"
            getKey={(record) => record.id}
            renderRecord={(record) => (
              <GemRecordCard
                className="employment-card"
                icon="◆"
                title={record.employerName}
                subtitle={record.positionTitle}
                status={record.employmentStatus}
                selected={selectedRecord?.id === record.id}
                onSelect={() => setSelectedID(record.id)}
              />
            )}
          />
          <div>
            <QueryFeedback query={detail} />
            {selectedRecord ? (
              <EmploymentDetail
                record={selectedRecord}
                saving={patch.isPending}
                error={patch.error}
                onPatch={async (values) => {
                  await patch.mutateAsync({ id: selectedRecord.id, patch: values });
                }}
              />
            ) : (
              !selectedID && (
                <div className="detail-placeholder">
                  <span>◆</span>
                  <p>Select an employment record to view its details.</p>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </>
  );
}

function EmploymentDetail({
  record,
  saving,
  error,
  onPatch,
}: {
  record: Employment;
  saving: boolean;
  error: Error | null;
  onPatch: (values: Partial<Employment>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [positionTitle, setPositionTitle] = useState(record.positionTitle);
  return (
    <article className="employment-detail">
      <div className="detail-heading">
        <div>
          <p className="eyebrow">Employment record</p>
          <h3>{record.employerName}</h3>
          <p className="employment-code">{record.id}</p>
        </div>
        <span className="status-pill">{record.employmentStatus}</span>
      </div>
      {editing ? (
        <form
          className="edit-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (positionTitle === record.positionTitle) {
              setEditing(false);
              return;
            }
            await onPatch({ positionTitle });
            setEditing(false);
          }}
        >
          <label>
            Position
            <input value={positionTitle} onChange={(event) => setPositionTitle(event.target.value)} />
          </label>
          {error && <p role="alert">{error.message} Try again.</p>}
          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save position"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPositionTitle(record.positionTitle);
              setEditing(false);
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setEditing(true)}>
          Edit position
        </button>
      )}
      <dl className="employment-fields">
        <Field label="Position" value={record.positionTitle} />
        <Field label="Employer type" value={record.employerType} />
        <Field label="Employment type" value={record.employmentType} />
        <Field label="Industry" value={record.industry} />
        <Field label="Start date" value={record.startDate} />
        <Field label="End date" value={record.endDate} />
        <div className="employment-address">
          <dt>Work address</dt>
          <dd>
            <AddressSummary address={record.address} />
          </dd>
        </div>
        <div>
          <dt>Website</dt>
          <dd>
            {record.website ? (
              <a href={record.website} target="_blank" rel="noreferrer">
                {record.website}
              </a>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <Field label="Contact" value={record.employerContact} />
        <Field label="Contact number" value={record.employerContactNumber} />
        <Field label="Contact email" value={record.employerContactEmail} />
        <div className="employment-notes">
          <dt>Notes</dt>
          <dd>{record.notes || "—"}</dd>
        </div>
      </dl>
    </article>
  );
}

function AddressSummary({ address }: { address: Employment["address"] }) {
  if (!address) return <>—</>;
  return <>{[address.addressLine1, address.city, address.state, address.postalCode].filter(Boolean).join(", ")}</>;
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}
