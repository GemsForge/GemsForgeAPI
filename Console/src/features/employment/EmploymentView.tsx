import { usePagedRecords } from "../../hooks/usePagedRecords";
import { PaginationControls } from "../../components/PaginationControls";
import { useState } from "react";
import { useEmploymentPatchMutation, useEmploymentRecordQuery } from "../../data/recordQueries";
import { QueryFeedback } from "../../components/QueryFeedback";
import type { Employment } from "../../types";
import { GemEmptyState, GemRecordCard, GemRecordList } from "../../components/ui";
import { EditableRecordFields, formatRecordDate, formatRecordTimestamp } from "../../components/EditableRecordFields";
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
      <EditableRecordFields
        className="employment-fields"
        fields={[
          {
            label: "Employer",
            value: record.employerName,
            required: true,
            onSave: async (value) => onPatch({ employerName: value as string }),
          },
          {
            label: "Employer type",
            value: record.employerType,
            required: true,
            onSave: async (value) => onPatch({ employerType: value as string }),
          },
          {
            label: "Position",
            value: record.positionTitle,
            required: true,
            onSave: async (value) => onPatch({ positionTitle: value as string }),
          },
          {
            label: "Employment type",
            value: record.employmentType,
            required: true,
            onSave: async (value) => onPatch({ employmentType: value as string }),
          },
          {
            label: "Employment status",
            value: record.employmentStatus,
            required: true,
            onSave: async (value) => onPatch({ employmentStatus: value as string }),
          },
          {
            label: "Industry",
            value: record.industry,
            nullable: true,
            onSave: async (value) => onPatch({ industry: value as string | null }),
          },
          {
            label: "Start date",
            value: record.startDate,
            inputType: "date",
            nullable: true,
            displayValue: formatRecordDate(record.startDate),
            onSave: async (value) => onPatch({ startDate: value as string | null }),
          },
          {
            label: "End date",
            value: record.endDate,
            inputType: "date",
            nullable: true,
            displayValue: formatRecordDate(record.endDate),
            onSave: async (value) => onPatch({ endDate: value as string | null }),
          },
          {
            label: "Work address",
            value: null,
            displayValue: <AddressSummary address={record.address} />,
            readOnlyReason: "Address relationship",
          },
          {
            label: "Website",
            value: record.website,
            inputType: "url",
            nullable: true,
            onSave: async (value) => onPatch({ website: value as string | null }),
          },
          {
            label: "Contact",
            value: record.employerContact,
            nullable: true,
            onSave: async (value) => onPatch({ employerContact: value as string | null }),
          },
          {
            label: "Contact number",
            value: record.employerContactNumber,
            nullable: true,
            onSave: async (value) => onPatch({ employerContactNumber: value as string | null }),
          },
          {
            label: "Contact email",
            value: record.employerContactEmail,
            inputType: "email",
            nullable: true,
            onSave: async (value) => onPatch({ employerContactEmail: value as string | null }),
          },
          {
            label: "Notes",
            value: record.notes,
            inputType: "textarea",
            nullable: true,
            className: "record-notes",
            onSave: async (value) => onPatch({ notes: value as string | null }),
          },
          {
            label: "Last updated",
            value: record.updatedAt ?? null,
            readOnlyReason: "Server managed",
            displayValue: formatRecordTimestamp(record.updatedAt),
          },
        ]}
      />
    </article>
  );
}

function AddressSummary({ address }: { address: Employment["address"] }) {
  if (!address) return <>—</>;
  return <>{[address.addressLine1, address.city, address.state, address.postalCode].filter(Boolean).join(", ")}</>;
}
