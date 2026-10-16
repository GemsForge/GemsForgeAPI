import { usePagedRecords } from "../../hooks/usePagedRecords";
import { PaginationControls } from "../../components/PaginationControls";
import { useState } from "react";
import { useAddressQuery, useAddressAttachmentMutation, useAddressPatchMutation } from "../../data/recordQueries";
import { QueryFeedback } from "../../components/QueryFeedback";
import type { Address } from "../../types";
import { AttachmentControl } from "../../components/AttachmentControl";
import { GemEmptyState, GemRecordCard, GemRecordList } from "../../components/ui";
import { RecordFields } from "../../components/RecordFields";
import { PropertyEditor } from "../../components/PropertyEditor";
import { useCreateAddressMutation } from "../../data/recordQueries";
import { AddressCreateForm } from "../create/RecordCreateForms";

interface AddressesViewProps {
  records: Address[];
}

export function AddressesView({ records }: AddressesViewProps) {
  const paging = usePagedRecords(records);
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
        </div>
      </div>

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
            getKey={(record) => record.id}
            renderRecord={(record) => (
              <GemRecordCard
                className="address-card"
                icon="⌂"
                title={record.city || record.addressType}
                subtitle={`${record.addressType} · ${record.id}`}
                status={record.addressStatus}
                selected={selectedID === record.id}
                onSelect={() => setSelectedID(record.id)}
              />
            )}
          />
          <div>
            <QueryFeedback query={detail} />
            {selectedAddress ? (
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
            ) : (
              !selectedID && (
                <div className="detail-placeholder">
                  <span>⌂</span>
                  <p>Select an address to view its details.</p>
                </div>
              )
            )}
          </div>
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
      <PropertyEditor
        label="City"
        initialValue={record.city ?? ""}
        editLabel="Edit city"
        saveLabel="Save city"
        onSave={async (city) => onPatch({ city })}
      />
      <RecordFields
        className="address-fields"
        fields={[
          { label: "Address line 1", value: record.addressLine1 || "—" },
          { label: "Address line 2", value: record.addressLine2 || "—" },
          { label: "City", value: record.city || "—" },
          { label: "State", value: record.state || "—" },
          { label: "Postal code", value: record.postalCode || "—" },
          { label: "Country", value: record.country || "—" },
          { label: "Start date", value: record.startDate || "—" },
          { label: "End date", value: record.endDate || "—" },
          { label: "Notes", value: record.notes || "—", className: "record-notes" },
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
