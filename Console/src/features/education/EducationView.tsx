import { usePagedRecords } from "../../hooks/usePagedRecords";
import { PaginationControls } from "../../components/PaginationControls";
import { useState } from "react";
import { useEducationPatchMutation, useEducationRecordQuery } from "../../data/recordQueries";
import { QueryFeedback } from "../../components/QueryFeedback";
import type { Education } from "../../types";
import { GemEmptyState, GemRecordCard, GemRecordList } from "../../components/ui";
import { AttachmentControl } from "../../components/AttachmentControl";
import { EditableRecordFields, formatRecordTimestamp } from "../../components/EditableRecordFields";
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
          <RecordImport label="education records" expectedColumns={["id", "educationType", "institutionName", "status"]} onPublish={async (rows) => { for (const row of rows) await create.mutateAsync(row as Parameters<typeof create.mutateAsync>[0]); }} />
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
                onAttachment={async (metadata) => {
                  await patch.mutateAsync({
                    id: selectedRecord.id,
                    patch: { documentFileMetadataID: metadata?.id ?? null },
                  });
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
  onAttachment,
}: {
  record: Education;
  onPatch: (values: Partial<Education>) => Promise<void>;
  onAttachment: (metadata: import("../../types").FileMetadata | null) => Promise<void>;
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
      <EditableRecordFields
        className="education-fields"
        fields={[
          { label: "Type", value: <EditableEducationField label="Type" value={record.educationType} editLabel="Edit type" onSave={(value) => onPatch({ educationType: value })} /> },
          { label: "Program", value: <EditableEducationField label="Program" value={record.program} editLabel="Edit program" onSave={(value) => onPatch({ program: value || null })} /> },
          { label: "Field of study", value: <EditableEducationField label="Field of study" value={record.fieldOfStudy} editLabel="Edit field of study" onSave={(value) => onPatch({ fieldOfStudy: value || null })} /> },
          { label: "Credential", value: <EditableEducationField label="Credential" value={record.credential} editLabel="Edit credential" onSave={(value) => onPatch({ credential: value || null })} /> },
          { label: "Start date", value: <EditableEducationField label="Start date" value={record.startDate} editLabel="Edit start date" onSave={(value) => onPatch({ startDate: value || null })} /> },
          { label: "End date", value: <EditableEducationField label="End date" value={record.endDate} editLabel="Edit end date" onSave={(value) => onPatch({ endDate: value || null })} /> },
          { label: "Awarded date", value: <EditableEducationField label="Awarded date" value={record.awardedDate} editLabel="Edit awarded date" onSave={(value) => onPatch({ awardedDate: value || null })} /> },
          { label: "Location", value: <AddressSummary address={record.address} /> },
          { label: "Credential ID", value: <EditableEducationField label="Credential ID" value={record.credentialID} editLabel="Edit credential ID" onSave={(value) => onPatch({ credentialID: value || null })} /> },
          {
            label: "Website",
            value: <EditableEducationField label="Website" value={record.website} editLabel="Edit website" onSave={(value) => onPatch({ website: value || null })} />,
          },
          { label: "Notes", value: <EditableEducationField label="Notes" value={record.notes} editLabel="Edit notes" onSave={(value) => onPatch({ notes: value || null })} />, className: "record-notes" },
        ]}
      />
      <AttachmentControl
        fileMetadataID={record.documentFileMetadataID}
        ownerType="Education"
        ownerID={record.id}
        label="Education document"
        onAttach={onAttachment}
      />
    </article>
  );
}

function EditableEducationField({ label, value, editLabel, onSave }: { label: string; value: string | null; editLabel: string; onSave: (value: string) => Promise<void> }) {
  return <span className="editable-field"><span>{value || "—"}</span><PropertyEditor label={label} initialValue={value || ""} editLabel={editLabel} saveLabel={`Save ${label.toLowerCase()}`} onSave={onSave} /></span>;
}

function AddressSummary({ address }: { address: Education["address"] }) {
  if (!address) return <>—</>;
  return <>{[address.addressLine1, address.city, address.state, address.postalCode].filter(Boolean).join(", ")}</>;
}
