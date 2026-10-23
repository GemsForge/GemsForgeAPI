import { useState } from "react";
import { useEmploymentPatchMutation, useEmploymentRecordQuery } from "../../data/recordQueries";
import { QueryFeedback } from "../../components/QueryFeedback";
import type { Employment } from "../../types";
import { GemEmptyState } from "../../components/ui";
import { EditableRecordFields, formatRecordDate, formatRecordTimestamp } from "../../components/EditableRecordFields";
import { useAddressesQuery } from "../../data/lifeQueries";
import { EmploymentCreateForm } from "../create/RecordCreateForms";
import { RecordImport } from "../../components/RecordImport";
import { RecordCreateButton } from "../../components/RecordCreateButton";
import { useRecordUtilities } from "../../hooks/useRecordUtilities";
import { DatabaseRecordCollection } from "../../components/DatabaseRecordCollection";
import { employmentTableAdapter } from "../database/recordTableAdapters";
import { employmentOptions, toOptions, useEmploymentRecordActions } from "./useEmploymentRecordActions";

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
  const { create, actions } = useEmploymentRecordActions({
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
          {records.length === 0 && <RecordCreateButton label="employment" onCreate={() => setCreating(true)} />}
        </div>
        <RecordImport
          label="employment records"
          expectedColumns={[
            "id",
            "employerName",
            "employerType",
            "positionTitle",
            "employmentType",
            "employmentStatus",
          ]}
          open={importing}
          onOpenChange={setImporting}
          showTrigger={records.length === 0}
          onPublish={async (rows) => {
            for (const row of rows) await create.mutateAsync(row as Parameters<typeof create.mutateAsync>[0]);
          }}
        />
      </div>
      {creating && (
        <EmploymentCreateForm
          addresses={addresses.data ?? []}
          employerTypeOptions={toOptions(employmentOptions.employerType)}
          industryOptions={toOptions(employmentOptions.industry)}
          employmentTypeOptions={toOptions(employmentOptions.employmentType)}
          statusOptions={toOptions(employmentOptions.status)}
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
            detail={
              selectedID ? (
                <>
                  <QueryFeedback query={detail} />
                  {selectedRecord && (
                    <EmploymentDetail
                      key={selectedRecord.id}
                      record={selectedRecord}
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
  onPatch,
}: {
  record: Employment;
  onPatch: (values: Partial<Employment>) => Promise<void>;
}) {
  const addresses = useAddressesQuery(true);

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
            inputType: "select",
            options: toOptions(employmentOptions.employerType),
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
            inputType: "select",
            options: toOptions(employmentOptions.employmentType),
            required: true,
            onSave: async (value) => onPatch({ employmentType: value as string }),
          },
          {
            label: "Employment status",
            value: record.employmentStatus,
            inputType: "select",
            options: toOptions(employmentOptions.status),
            required: true,
            onSave: async (value) => onPatch({ employmentStatus: value as string }),
          },
          {
            label: "Industry",
            value: record.industry,
            inputType: "select",
            options: toOptions(employmentOptions.industry),
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
            value: record.address?.id ?? null,
            inputType: "select",
            nullable: true,
            options: (addresses.data ?? []).map((address) => ({
              value: address.id,
              label: addressOptionLabel(address),
            })),
            displayValue: <AddressSummary address={record.address} />,
            onSave: async (value) => onPatch({ workAddressID: value as string | null }),
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
            inputType: "text",
            nullable: true,
            onSave: async (value) => onPatch({ employerContact: value as string | null }),
          },
          {
            label: "Contact number",
            value: record.employerContactNumber,
            inputType: "tel",
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
            inputType: "longText",
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

function addressOptionLabel(address: NonNullable<Employment["address"]>) {
  return [address.addressType, address.addressLine1, address.city, address.state].filter(Boolean).join(" · ");
}
