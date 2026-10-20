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
  const addresses = useAddressesQuery(true);
  const programOptions = Array.from(new Set(records.map((record) => record.program).filter((program): program is string => Boolean(program)))).sort();

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
            onExpandedChange={setSelectedID}
            getKey={(record) => record.id}
            renderRecord={(record) => (
              <GemRecordCard
                className="education-card"
                icon="✦"
                title={record.institutionName}
                subtitle={record.educationType}
                status={record.status}
                selected={selectedRecord?.id === record.id}
                onSelect={() => setSelectedID((current) => current === record.id ? null : record.id)}
              />
            )}
          />
          <div>
            <QueryFeedback query={detail} />
            {selectedRecord ? (
              <EducationDetail
                key={selectedRecord.id}
                record={selectedRecord}
                programOptions={programOptions}
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
          />
        </div>
      )}
    </>
  );
}

function EducationDetail({
  record,
  programOptions,
  onPatch,
  onAttachment,
}: {
  record: Education;
  programOptions: string[];
  onPatch: (values: Partial<Education>) => Promise<void>;
  onAttachment: (metadata: import("../../types").FileMetadata | null) => Promise<void>;
}) {
  const addresses = useAddressesQuery(true);

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
          {
            label: "Type", value: record.educationType, required: true,
            onSave: async (value) => onPatch({ educationType: value as string }),
          },
          { label: "Institution", value: record.institutionName, required: true, onSave: async (value) => onPatch({ institutionName: value as string }) },
          {
            label: "Program",
            value: record.program,
            inputType: "select",
            nullable: true,
            options: programOptions.map((program) => ({ value: program, label: program })),
            onSave: async (value) => onPatch({ program: value as string | null }),
          },
          { label: "Field of study", value: record.fieldOfStudy, nullable: true, onSave: async (value) => onPatch({ fieldOfStudy: value as string | null }) },
          { label: "Credential", value: record.credential, nullable: true, onSave: async (value) => onPatch({ credential: value as string | null }) },
          { label: "Credential ID", value: record.credentialID, nullable: true, onSave: async (value) => onPatch({ credentialID: value as string | null }) },
          { label: "Start date", value: record.startDate, inputType: "date", nullable: true, onSave: async (value) => onPatch({ startDate: value as string | null }) },
          { label: "End date", value: record.endDate, inputType: "date", nullable: true, onSave: async (value) => onPatch({ endDate: value as string | null }) },
          { label: "Awarded date", value: record.awardedDate, inputType: "date", nullable: true, onSave: async (value) => onPatch({ awardedDate: value as string | null }) },
          { label: "Status", value: record.status, required: true, onSave: async (value) => onPatch({ status: value as string }) },
          {
            label: "Location", value: record.address?.id ?? null, inputType: "select", nullable: true,
            options: (addresses.data ?? []).map((address) => ({ value: address.id, label: addressOptionLabel(address) })),
            displayValue: <AddressSummary address={record.address} />,
            onSave: async (value) => onPatch({ locationAddressID: value as string | null }),
          },
          { label: "Website", value: record.website, inputType: "url", nullable: true, onSave: async (value) => onPatch({ website: value as string | null }) },
          { label: "Notes", value: record.notes, inputType: "longText", nullable: true, className: "record-notes", onSave: async (value) => onPatch({ notes: value as string | null }) },
          { label: "Last updated", value: record.updatedAt ?? null, readOnlyReason: "Server managed", displayValue: formatRecordTimestamp(record.updatedAt) },
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

function AddressSummary({ address }: { address: Education["address"] }) {
  if (!address) return <>—</>;
  return <>{[address.addressLine1, address.city, address.state, address.postalCode].filter(Boolean).join(", ")}</>;
}

function addressOptionLabel(address: NonNullable<Education["address"]>) {
  return [address.addressType, address.addressLine1, address.city, address.state].filter(Boolean).join(" · ");
}
