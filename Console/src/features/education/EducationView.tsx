import { useState } from "react";
import { useEducationPatchMutation, useEducationRecordQuery } from "../../data/recordQueries";
import { QueryFeedback } from "../../components/QueryFeedback";
import type { Education } from "../../types";
import { GemEmptyState } from "../../components/ui";
import { AttachmentControl } from "../../components/AttachmentControl";
import { EditableRecordFields } from "../../components/EditableRecordFields";
import { useAddressesQuery } from "../../data/lifeQueries";
import { RecordImport } from "../../components/RecordImport";
import { useRecordUtilities } from "../../hooks/useRecordUtilities";
import { DatabaseRecordCollection } from "../../components/DatabaseRecordCollection";
import { educationTableAdapter } from "../database/recordTableAdapters";
import { useEducationRecordActions } from "./useEducationRecordActions";
import { educationFieldDefinitions } from "./educationCreateFields";
import { educationEditableFields } from "./educationRecordFields";
import { GemPrimitiveField, GemField } from "../../components/ui";
import { useRecordEditor } from "../../hooks/useRecordEditor";

interface EducationViewProps {
  records: Education[];
}

export function EducationView({ records }: EducationViewProps) {
  const utilities = useRecordUtilities(
    records,
    (record) => [record.id, record.institutionName, record.educationType, record.program, record.status],
    {
      institution: (a, b) => a.institutionName.localeCompare(b.institutionName),
      status: (a, b) => a.status.localeCompare(b.status),
      type: (a, b) => a.educationType.localeCompare(b.educationType),
      program: (a, b) => (a.program ?? "").localeCompare(b.program ?? ""),
      start: (a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""),
      end: (a, b) => (a.endDate ?? "").localeCompare(b.endDate ?? ""),
    },
  );
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const detail = useEducationRecordQuery(selectedID);
  const patch = useEducationPatchMutation();
  const selectedRecord = detail.data;
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const addresses = useAddressesQuery(true);
  const { publish, importConfig, actions, createForm } = useEducationRecordActions({
    addresses: addresses.data ?? [],
    onCreated: setSelectedID,
  });

  return (
    <>
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
          {records.length === 0 && (
            <button type="button" onClick={() => setCreating(true)}>
              Add education
            </button>
          )}
        </div>
        <RecordImport
          {...importConfig}
          open={importing}
          onOpenChange={setImporting}
          showTrigger={records.length === 0}
          onPublish={publish}
        />
      </div>
      {creating && createForm(() => setCreating(false))}

      {records.length === 0 ? (
        <GemEmptyState
          icon="✦"
          title="No education records"
          description="The Education table did not return any records."
        />
      ) : (
        <div className="education-layout">
          <DatabaseRecordCollection
            label="Education"
            records={records}
            utilities={utilities}
            adapter={educationTableAdapter}
            sortOptions={[
              { value: "institution", label: "Institution" },
              { value: "status", label: "Status" },
              { value: "type", label: "Education type" },
              { value: "program", label: "Program" },
              { value: "start", label: "Start date" },
              { value: "end", label: "End date" },
            ]}
            filterOptions={Array.from(new Set(records.map((record) => record.status))).sort()}
            detailId={selectedID}
            onDetailChange={setSelectedID}
            actions={actions}
            onRecordPatch={async (record, field, value) => {
              await patch.mutateAsync({ id: record.id, patch: { [field]: value } as Partial<Education> });
            }}
            detail={
              selectedRecord ? (
                <>
                  <QueryFeedback query={detail} />
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
                </>
              ) : selectedID ? (
                <QueryFeedback query={detail} />
              ) : (
                <div className="detail-placeholder">
                  <span>✦</span>
                  <p>Select an education record to view its details.</p>
                </div>
              )
            }
          />
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
  const addresses = useAddressesQuery(true);
  const titleEditor = useRecordEditor(record.institutionName, async (value) => onPatch({ institutionName: value }));
  const titleProperty = educationFieldDefinitions.find((field) => field.name === "institutionName")!;
  const idProperty = educationFieldDefinitions.find((field) => field.name === "id")!;

  return (
    <article className="education-detail">
      <div className="detail-heading">
        <div>
          <p className="eyebrow">Education record</p>
          <GemField
            className="education-title-input"
            label={titleProperty.label}
            value={titleEditor.draft}
            editing={titleEditor.editing}
            displayValue={record.institutionName}
            onDisplayClick={titleEditor.begin}
            onChange={(event) => titleEditor.setDraft(event.currentTarget.value)}
            onBlur={() => void titleEditor.save()}
          />
          <GemPrimitiveField primitive="id" label={idProperty.label} value={record.id} editing={false} />
        </div>
        <span className="status-pill">{record.status}</span>
      </div>
      <EditableRecordFields
        className="education-fields"
        fields={educationEditableFields(record, addresses.data ?? [], onPatch)
          .filter((field) => field.label !== titleProperty.label)}
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
