import { useState } from "react";
import { useEmploymentPatchMutation, useEmploymentRecordQuery } from "../../data/recordQueries";
import { QueryFeedback } from "../../components/QueryFeedback";
import type { Employment } from "../../types";
import { GemEmptyState } from "../../components/ui";
import { EditableRecordFields } from "../../components/EditableRecordFields";
import { useAddressesQuery } from "../../data/lifeQueries";
import { RecordImport } from "../../components/RecordImport";
import { useRecordUtilities } from "../../hooks/useRecordUtilities";
import { DatabaseRecordCollection } from "../../components/DatabaseRecordCollection";
import { employmentTableAdapter } from "../database/recordTableAdapters";
import { employmentOptions, toOptions, useEmploymentRecordActions } from "./useEmploymentRecordActions";
import { createEmploymentFieldDefinitions, employmentAddressOptions } from "./employmentCreateFields";
import { employmentEditableFields } from "./employmentRecordFields";

interface EmploymentViewProps {
  records: Employment[];
}

export function EmploymentView({ records }: EmploymentViewProps) {
  const utilities = useRecordUtilities(
    records,
    (record) => [record.id, record.employerName, record.positionTitle, record.industry, record.employmentStatus],
    {
      employer: (a, b) => a.employerName.localeCompare(b.employerName),
      start: (a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""),
      position: (a, b) => a.positionTitle.localeCompare(b.positionTitle),
      industry: (a, b) => (a.industry ?? "").localeCompare(b.industry ?? ""),
      type: (a, b) => a.employmentType.localeCompare(b.employmentType),
      status: (a, b) => a.employmentStatus.localeCompare(b.employmentStatus),
      end: (a, b) => (a.endDate ?? "").localeCompare(b.endDate ?? ""),
    },
  );
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const detail = useEmploymentRecordQuery(selectedID);
  const patch = useEmploymentPatchMutation();
  const selectedRecord = detail.data;
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const addresses = useAddressesQuery(true);
  const definitions = createEmploymentFieldDefinitions({
    employerType: toOptions(employmentOptions.employerType),
    industry: toOptions(employmentOptions.industry),
    employmentType: toOptions(employmentOptions.employmentType),
    status: toOptions(employmentOptions.status),
    workAddress: employmentAddressOptions(addresses.data ?? []),
  });
  const { publish, importConfig, actions, createForm } = useEmploymentRecordActions({
    addresses: addresses.data ?? [],
    onCreated: setSelectedID,
  });

  return (
    <>
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
          {records.length === 0 && (
            <button type="button" onClick={() => setCreating(true)}>
              Add employment
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
          title="No employment records"
          description="The Employment table did not return any records."
        />
      ) : (
        <div className="employment-layout">
          <DatabaseRecordCollection
            label="Employment"
            records={records}
            utilities={utilities}
            adapter={employmentTableAdapter}
            sortOptions={[
              { value: "employer", label: "Employer" },
              { value: "start", label: "Start date" },
              { value: "position", label: "Position" },
              { value: "industry", label: "Industry" },
              { value: "type", label: "Employment type" },
              { value: "status", label: "Status" },
              { value: "end", label: "End date" },
            ]}
            filterOptions={Array.from(new Set(records.map((record) => record.employmentStatus))).sort()}
            detailId={selectedID}
            onDetailChange={setSelectedID}
            actions={actions}
            onRecordPatch={async (record, field, value) => {
              await patch.mutateAsync({ id: record.id, patch: { [field]: value } as Partial<Employment> });
            }}
            detail={
              selectedID ? (
                <>
                  <QueryFeedback query={detail} />
                  {selectedRecord && (
                    <EmploymentDetail
                      key={selectedRecord.id}
                      record={selectedRecord}
                      definitions={definitions}
                      onPatch={async (values) => {
                        await patch.mutateAsync({ id: selectedRecord.id, patch: values });
                      }}
                    />
                  )}
                </>
              ) : null
            }
          />
        </div>
      )}
    </>
  );
}

function EmploymentDetail({
  record,
  definitions,
  onPatch,
}: {
  record: Employment;
  definitions: ReturnType<typeof createEmploymentFieldDefinitions>;
  onPatch: (values: Partial<Employment>) => Promise<void>;
}) {

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
      <EditableRecordFields className="employment-fields" fields={employmentEditableFields(record, definitions, onPatch)} />
    </article>
  );
}
