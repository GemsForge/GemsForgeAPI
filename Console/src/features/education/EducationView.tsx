import { usePagedRecords } from "../../hooks/usePagedRecords";
import { PaginationControls } from "../../components/PaginationControls";
import { useState } from "react";
import { useEducationPatchMutation, useEducationRecordQuery } from "../../data/recordQueries";
import { QueryFeedback } from "../../components/QueryFeedback";
import type { Education } from "../../types";
import { GemEmptyState, GemRecordCard, GemRecordList } from "../../components/ui";
import { RecordFields } from "../../components/RecordFields";
import { PropertyEditor } from "../../components/PropertyEditor";
import { useCreateEducationMutation } from "../../data/recordQueries";
import { useAddressesQuery } from "../../data/lifeQueries";
import { EducationCreateForm } from "../create/RecordCreateForms";
import { RecordImport } from "../../components/RecordImport";

interface EducationViewProps {
  records: Education[];
}

export function EducationView({ records }: EducationViewProps) {
  const paging = usePagedRecords(records);
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const detail = useEducationRecordQuery(selectedID);
  const patch = useEducationPatchMutation();
  const selectedRecord = detail.data;
  const [creating, setCreating] = useState(false);
  const create = useCreateEducationMutation();
  const addresses = useAddressesQuery(creating);

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
        <div className="button-row">
          <span className="record-count">{records.length} records</span>
          <button type="button" onClick={() => setCreating(true)}>
            Add education
          </button>
          <RecordImport label="education records" onPublish={async (rows) => { for (const row of rows) await create.mutateAsync(row as Parameters<typeof create.mutateAsync>[0]); }} />
        </div>
      </div>

      {creating && (
        <EducationCreateForm
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
                key={selectedRecord.id}
                record={selectedRecord}
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
  onPatch,
}: {
  record: Education;
  onPatch: (values: Partial<Education>) => Promise<void>;
}) {
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
      <PropertyEditor
        label="Status"
        initialValue={record.status}
        editLabel="Edit status"
        saveLabel="Save status"
        onSave={async (status) => onPatch({ status })}
      />
      <RecordFields
        className="education-fields"
        fields={[
          { label: "Type", value: record.educationType || "—" },
          { label: "Program", value: record.program || "—" },
          { label: "Field of study", value: record.fieldOfStudy || "—" },
          { label: "Credential", value: record.credential || "—" },
          { label: "Start date", value: record.startDate || "—" },
          { label: "End date", value: record.endDate || "—" },
          { label: "Awarded date", value: record.awardedDate || "—" },
          { label: "Location", value: <AddressSummary address={record.address} /> },
          { label: "Credential ID", value: record.credentialID || "—" },
          {
            label: "Website",
            value: record.website ? (
              <a href={record.website} target="_blank" rel="noreferrer">
                {record.website}
              </a>
            ) : (
              "—"
            ),
          },
          { label: "Notes", value: record.notes || "—", className: "record-notes" },
        ]}
      />
    </article>
  );
}

function AddressSummary({ address }: { address: Education["address"] }) {
  if (!address) return <>—</>;
  return <>{[address.addressLine1, address.city, address.state, address.postalCode].filter(Boolean).join(", ")}</>;
}
