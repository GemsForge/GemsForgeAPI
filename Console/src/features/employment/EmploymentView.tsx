import { useState } from "react";
import { useEmploymentRecordQuery } from "../../data/recordQueries";
import { QueryFeedback } from "../../components/QueryFeedback";
import type { Employment } from "../../types";

interface EmploymentViewProps {
  records: Employment[];
}

export function EmploymentView({ records }: EmploymentViewProps) {
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const detail = useEmploymentRecordQuery(selectedID);
  const selectedRecord = detail.data;

  return (
    <>
      <div className="content-heading">
        <div>
          <p className="eyebrow">Life-area records</p>
          <h2>Employment</h2>
          <p className="muted">Read employment history from the existing Gem Life database. These records are not assigned to a Domain.</p>
        </div>
        <span className="record-count">{records.length} records</span>
      </div>

      {records.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">✦</div><h3>No employment records</h3><p>The Employment table did not return any records.</p></div>
      ) : (
        <div className="employment-layout">
          <div className="employment-list" aria-label="Employment records">
            {records.map((record) => (
              <button
                className={`employment-card ${selectedRecord?.id === record.id ? "selected" : ""}`}
                key={record.id}
                onClick={() => setSelectedID(record.id)}
              >
                <span className="employment-icon">◆</span>
                <span className="employment-card-copy">
                  <strong>{record.employerName}</strong>
                  <small>{record.positionTitle}</small>
                </span>
                <span className="employment-status">{record.employmentStatus}</span>
              </button>
            ))}
          </div>
          <div><QueryFeedback query={detail} />{selectedRecord ? <EmploymentDetail record={selectedRecord} /> : !selectedID && <div className="detail-placeholder"><span>◆</span><p>Select an employment record to view its details.</p></div>}</div>
        </div>
      )}
    </>
  );
}

function EmploymentDetail({ record }: { record: Employment }) {
  return (
    <article className="employment-detail">
      <div className="detail-heading">
        <div><p className="eyebrow">Employment record</p><h3>{record.employerName}</h3><p className="employment-code">{record.id}</p></div>
        <span className="status-pill">{record.employmentStatus}</span>
      </div>
      <dl className="employment-fields">
        <Field label="Position" value={record.positionTitle} />
        <Field label="Employer type" value={record.employerType} />
        <Field label="Employment type" value={record.employmentType} />
        <Field label="Industry" value={record.industry} />
        <Field label="Start date" value={record.startDate} />
        <Field label="End date" value={record.endDate} />
        <div className="employment-address"><dt>Work address</dt><dd><AddressSummary address={record.address} /></dd></div>
        <div><dt>Website</dt><dd>{record.website ? <a href={record.website} target="_blank" rel="noreferrer">{record.website}</a> : "—"}</dd></div>
        <Field label="Contact" value={record.employerContact} />
        <Field label="Contact number" value={record.employerContactNumber} />
        <Field label="Contact email" value={record.employerContactEmail} />
        <div className="employment-notes"><dt>Notes</dt><dd>{record.notes || "—"}</dd></div>
      </dl>
    </article>
  );
}

function AddressSummary({ address }: { address: Employment["address"] }) {
  if (!address) return <>—</>;
  return <>{[address.addressLine1, address.city, address.state, address.postalCode].filter(Boolean).join(", ")}</>;
}

function Field({ label, value }: { label: string; value: string | null }) {
  return <div><dt>{label}</dt><dd>{value || "—"}</dd></div>;
}
