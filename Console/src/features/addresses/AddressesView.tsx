import { usePagedRecords } from "../../hooks/usePagedRecords";
import { PaginationControls } from "../../components/PaginationControls";
import { useState } from "react";
import { RecordUtilities } from "../../components/RecordUtilities";
import { RecordCollection } from "../../components/RecordCollection";
import { useRecordUtilities } from "../../hooks/useRecordUtilities";
import { useAddressQuery, useAddressAttachmentMutation, useAddressPatchMutation } from "../../data/recordQueries";
import { QueryFeedback } from "../../components/QueryFeedback";
import type { Address } from "../../types";
import { AttachmentControl } from "../../components/AttachmentControl";
import { GemEmptyState, GemRecordCard, GemRecordList } from "../../components/ui";
import { EditableRecordFields, formatRecordDate, formatRecordTimestamp } from "../../components/EditableRecordFields";
import { useCreateAddressMutation } from "../../data/recordQueries";
import { AddressCreateForm } from "../create/RecordCreateForms";
import { RecordImport } from "../../components/RecordImport";

interface AddressesViewProps {
  records: Address[];
}

export function AddressesView({ records }: AddressesViewProps) {
  const utilities = useRecordUtilities(
    records,
    (record) => [record.id, record.city, record.state, record.addressType, record.country, record.addressStatus],
    {
      city: (a, b) => (a.city ?? "").localeCompare(b.city ?? ""),
      type: (a, b) => a.addressType.localeCompare(b.addressType),
    },
  );
  const paging = usePagedRecords(utilities.records);
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const detail = useAddressQuery(selectedID);
  const attachment = useAddressAttachmentMutation();
  const patch = useAddressPatchMutation();
  const selectedAddress = detail.data;
  const [creating, setCreating] = useState(false);
  const create = useCreateAddressMutation();

  return (
    <>
      <PaginationControls {...paging} label="Addresses" />
      <div className="content-heading">
        <div>
          <p className="eyebrow">Life-area records</p>
          <h2>Addresses</h2>
          <p className="muted">Read address records and inspect the locations referenced by other Life-area tables.</p>
        </div>
        <div className="button-row">
          <span className="record-count">{records.length} records</span>
          <button type="button" onClick={() => setCreating(true)}>
            Add address
          </button>
          <RecordImport
            label="addresses"
            expectedColumns={["id", "addressType", "country"]}
            onPublish={async (rows) => {
              for (const row of rows) await create.mutateAsync(row as Parameters<typeof create.mutateAsync>[0]);
            }}
          />
        </div>
      </div>
      <RecordCollection>
        <RecordUtilities
          label="Addresses"
          {...utilities}
          totalCount={records.length}
          visibleCount={utilities.records.length}
          sortOptions={[
            { value: "city", label: "City" },
            { value: "type", label: "Address type" },
          ]}
          filterOptions={Array.from(new Set(records.map((record) => record.addressStatus))).sort()}
        />
      </RecordCollection>

      {creating && (
        <AddressCreateForm
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
          icon="⌂"
          title="No address records"
          description="The Addresses table did not return any records."
        />
      ) : (
        <div className="address-layout">
          <GemRecordList
            className="address-list"
            records={paging.items}
            label="Address records"
            onExpandedChange={setSelectedID}
            getKey={(record) => record.id}
            renderRecord={(record) => (
              <GemRecordCard
                className="address-card"
                icon="⌂"
                title={record.city || record.addressType}
                subtitle={`${record.addressType} · ${record.id}`}
                status={record.addressStatus}
                selected={selectedID === record.id}
                onSelect={() => setSelectedID((current) => (current === record.id ? null : record.id))}
              />
            )}
            isExpanded={(record) => selectedID === record.id}
            renderExpanded={() => (
              <>
                <QueryFeedback query={detail} />
                {selectedAddress && (
                  <AddressDetail
                    key={selectedAddress.id}
                    record={selectedAddress}
                    onAttachment={async (metadata) => {
                      await attachment.mutateAsync({ id: selectedAddress.id, fileID: metadata?.id ?? null });
                    }}
                    onPatch={async (values) => {
                      await patch.mutateAsync({ id: selectedAddress.id, patch: values });
                    }}
                  />
                )}
              </>
            )}
          />
        </div>
      )}
    </>
  );
}

function AddressDetail({
  record,
  onAttachment,
  onPatch,
}: {
  record: Address;
  onAttachment: (metadata: import("../../types").FileMetadata | null) => Promise<void>;
  onPatch: (values: Partial<Address>) => Promise<void>;
}) {
  return (
    <article className="address-detail">
      <div className="detail-heading">
        <div>
          <p className="eyebrow">Address record</p>
          <h3>{record.addressType}</h3>
          <p className="address-code">{record.id}</p>
        </div>
        <span className="status-pill">{record.addressStatus}</span>
      </div>
      <EditableRecordFields
        className="address-fields"
        fields={[
          {
            label: "Address type",
            value: record.addressType,
            required: true,
            inputType: "select",
            options: [
              { label: "Residence", value: "Residence" },
              { label: "Storage", value: "Storage" },
              { label: "Work", value: "Work" },
              { label: "School", value: "School" },
              { label: "Other", value: "Other" },
            ],
            onSave: async (value) => onPatch({ addressType: value as string }),
          },
          {
            label: "Address line 1",
            value: record.addressLine1,
            nullable: true,
            onSave: async (value) => onPatch({ addressLine1: value as string | null }),
          },
          {
            label: "Address line 2",
            value: record.addressLine2,
            nullable: true,
            onSave: async (value) => onPatch({ addressLine2: value as string | null }),
          },
          {
            label: "City",
            value: record.city,
            nullable: true,
            onSave: async (value) => onPatch({ city: value as string | null }),
          },
          {
            label: "State",
            value: record.state,
            nullable: true,
            onSave: async (value) => onPatch({ state: value as string | null }),
          },
          {
            label: "Postal code",
            value: record.postalCode,
            nullable: true,
            onSave: async (value) => onPatch({ postalCode: value as string | null }),
          },
          {
            label: "Country",
            value: record.country,
            required: true,
            onSave: async (value) => onPatch({ country: value as string }),
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
            label: "Address status",
            value: record.addressStatus,
            required: true,
            inputType: "select",
            options: [
              { label: "Current", value: "Current" },
              { label: "Former", value: "Former" },
              { label: "Seasonal", value: "Seasonal" },
              { label: "Other", value: "Other" },
            ],
            onSave: async (value) => onPatch({ addressStatus: value as string }),
          },
          {
            label: "Notes",
            value: record.notes ?? null,
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
      <AttachmentControl
        fileMetadataID={record.imageFileMetadataID}
        ownerType="Address"
        ownerID={record.id}
        label="Address image"
        onAttach={onAttachment}
      />
    </article>
  );
}
