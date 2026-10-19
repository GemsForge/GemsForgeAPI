import { usePagedRecords } from "../../hooks/usePagedRecords";
import { PaginationControls } from "../../components/PaginationControls";
import { useState } from "react";
import { useEmploymentPatchMutation, useEmploymentRecordQuery } from "../../data/recordQueries";
import { QueryFeedback } from "../../components/QueryFeedback";
import type { Employment } from "../../types";
import { GemEmptyState, GemRecordCard, GemRecordList } from "../../components/ui";
import { RecordFields } from "../../components/RecordFields";
import { PropertyEditor } from "../../components/PropertyEditor";
import { useCreateEmploymentMutation } from "../../data/recordQueries";
import { useAddressesQuery } from "../../data/lifeQueries";
import { EmploymentCreateForm } from "../create/RecordCreateForms";
import { RecordImport } from "../../components/RecordImport";

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
          <RecordImport label="employment records" expectedColumns={["id", "employerName", "employerType", "positionTitle", "employmentType", "employmentStatus"]} onPublish={async (rows) => { for (const row of rows) await create.mutateAsync(row as Parameters<typeof create.mutateAsync>[0]); }} />
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
                key={selectedRecord.id}
                record={selectedRecord}
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
  onPatch,
}: {
  record: Employment;
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
      <PropertyEditor
        label="Position"
        initialValue={record.positionTitle}
        editLabel="Edit position"
        saveLabel="Save position"
        onSave={async (positionTitle) => onPatch({ positionTitle })}
      />
      <RecordFields
        className="employment-fields"
        fields={[
          { label: "Position", value: record.positionTitle || "—" },
          { label: "Employer type", value: record.employerType || "—" },
          { label: "Employment type", value: record.employmentType || "—" },
          { label: "Industry", value: record.industry || "—" },
          { label: "Start date", value: record.startDate || "—" },
          { label: "End date", value: record.endDate || "—" },
          { label: "Work address", value: <AddressSummary address={record.address} /> },
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
          { label: "Contact", value: record.employerContact || "—" },
          { label: "Contact number", value: record.employerContactNumber || "—" },
          { label: "Contact email", value: record.employerContactEmail || "—" },
          { label: "Notes", value: record.notes || "—", className: "record-notes" },
        ]}
      />
    </article>
  );
}

function AddressSummary({ address }: { address: Employment["address"] }) {
  if (!address) return <>—</>;
  return <>{[address.addressLine1, address.city, address.state, address.postalCode].filter(Boolean).join(", ")}</>;
}
