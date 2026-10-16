import { usePagedRecords } from "../../hooks/usePagedRecords";
import { PaginationControls } from "../../components/PaginationControls";
import { useState } from "react";
import { useEducationPatchMutation, useEducationRecordQuery } from "../../data/recordQueries";
import { QueryFeedback } from "../../components/QueryFeedback";
import type { Education } from "../../types";
import { GemEmptyState, GemRecordCard, GemRecordList } from "../../components/ui";

interface EducationViewProps {
  records: Education[];
}

export function EducationView({ records }: EducationViewProps) {
  const paging = usePagedRecords(records);
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const detail = useEducationRecordQuery(selectedID);
  const patch = useEducationPatchMutation();
  const selectedRecord = detail.data;

  return (
    <>
      <PaginationControls {...paging} label="Education" />
      <div className="content-heading">
        <div>
          <p className="eyebrow">Life-area records</p>
          <h2>Education</h2>
          <p className="muted">
            Read education history from the existing Gem Life database. These records are not assigned to a Domain.
          </p>
        </div>
        <span className="record-count">{records.length} records</span>
      </div>

      {records.length === 0 ? (
        <GemEmptyState
          icon="✦"
          title="No education records"
          description="The Education table did not return any records."
        />
      ) : (
        <div className="education-layout">
          <GemRecordList
            className="education-list"
            records={paging.items}
            label="Education records"
            getKey={(record) => record.id}
            renderRecord={(record) => (
              <GemRecordCard
                className="education-card"
                icon="✦"
                title={record.institutionName}
                subtitle={record.educationType}
                status={record.status}
                selected={selectedRecord?.id === record.id}
                onSelect={() => setSelectedID(record.id)}
              />
            )}
          />
          <div>
            <QueryFeedback query={detail} />
            {selectedRecord ? (
              <EducationDetail
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
                  <span>✦</span>
                  <p>Select an education record to view its details.</p>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </>
  );
}

function EducationDetail({
  record,
  saving,
  error,
  onPatch,
}: {
  record: Education;
  saving: boolean;
  error: Error | null;
  onPatch: (values: Partial<Education>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(record.status);
  return (
    <article className="education-detail">
      <div className="detail-heading">
        <div>
          <p className="eyebrow">Education record</p>
          <h3>{record.institutionName}</h3>
          <p className="education-code">{record.id}</p>
        </div>
        <span className="status-pill">{record.status}</span>
      </div>
      {editing ? (
        <form
          className="edit-form"
          onSubmit={async (event) => {
            event.preventDefault();
            await onPatch({ status });
            setEditing(false);
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
              setStatus(record.status);
              setEditing(false);
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setEditing(true)}>
          Edit status
        </button>
      )}
      <dl className="education-fields">
        <Field label="Type" value={record.educationType} />
        <Field label="Program" value={record.program} />
        <Field label="Field of study" value={record.fieldOfStudy} />
        <Field label="Credential" value={record.credential} />
        <Field label="Start date" value={record.startDate} />
        <Field label="End date" value={record.endDate} />
        <Field label="Awarded date" value={record.awardedDate} />
        <div className="education-address">
          <dt>Location</dt>
          <dd>
            <AddressSummary address={record.address} />
          </dd>
        </div>
        <Field label="Credential ID" value={record.credentialID} />
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
        <div className="education-notes">
          <dt>Notes</dt>
          <dd>{record.notes || "—"}</dd>
        </div>
      </dl>
    </article>
  );
}

function AddressSummary({ address }: { address: Education["address"] }) {
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
