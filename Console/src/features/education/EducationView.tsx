import { useState } from "react";
import { api } from "../../api";
import type { Education } from "../../types";

interface EducationViewProps {
  records: Education[];
}

export function EducationView({ records }: EducationViewProps) {
  const [selectedRecord, setSelectedRecord] = useState<Education | null>(null);

  async function selectRecord(record: Education) {
    setSelectedRecord(await api.getEducation(record.id));
  }

  return (
    <>
      <div className="content-heading">
        <div>
          <p className="eyebrow">Life-area records</p>
          <h2>Education</h2>
          <p className="muted">Read education history from the existing Gem Life database. These records are not assigned to a Domain.</p>
        </div>
        <span className="record-count">{records.length} records</span>
      </div>

      {records.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">✦</div><h3>No education records</h3><p>The Education table did not return any records.</p></div>
      ) : (
        <div className="education-layout">
          <div className="education-list" aria-label="Education records">
            {records.map((record) => (
              <button
                className={`education-card ${selectedRecord?.id === record.id ? "selected" : ""}`}
                key={record.id}
                onClick={() => void selectRecord(record)}
              >
                <span className="education-icon">✦</span>
                <span className="education-card-copy">
                  <strong>{record.institutionName}</strong>
                  <small>{record.educationType}</small>
                </span>
                <span className="education-status">{record.status}</span>
              </button>
            ))}
          </div>
          {selectedRecord ? <EducationDetail record={selectedRecord} /> : <div className="detail-placeholder"><span>✦</span><p>Select an education record to view its details.</p></div>}
        </div>
      )}
    </>
  );
}

function EducationDetail({ record }: { record: Education }) {
  return (
    <article className="education-detail">
      <div className="detail-heading">
        <div><p className="eyebrow">Education record</p><h3>{record.institutionName}</h3><p className="education-code">{record.id}</p></div>
        <span className="status-pill">{record.status}</span>
      </div>
      <dl className="education-fields">
        <Field label="Type" value={record.educationType} />
        <Field label="Program" value={record.program} />
        <Field label="Field of study" value={record.fieldOfStudy} />
        <Field label="Credential" value={record.credential} />
        <Field label="Start date" value={record.startDate} />
        <Field label="End date" value={record.endDate} />
        <Field label="Awarded date" value={record.awardedDate} />
        <Field label="Address ID" value={record.locationAddressID} />
        <Field label="Credential ID" value={record.credentialID} />
        <div><dt>Website</dt><dd>{record.website ? <a href={record.website} target="_blank" rel="noreferrer">{record.website}</a> : "—"}</dd></div>
        <div className="education-notes"><dt>Notes</dt><dd>{record.notes || "—"}</dd></div>
      </dl>
    </article>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return <div><dt>{label}</dt><dd>{value || "—"}</dd></div>;
}
