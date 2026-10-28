import { useState } from "react";
import { useRecordUtilities } from "../../hooks/useRecordUtilities";
import { useAddressQuery, useAddressAttachmentMutation, useAddressPatchMutation } from "../../data/recordQueries";
import { QueryFeedback } from "../../components/QueryFeedback";
import type { Address } from "../../types";
import { AttachmentControl } from "../../components/AttachmentControl";
import { GemEmptyState } from "../../components/ui";
import { EditableRecordFields } from "../../components/EditableRecordFields";
import { addressEditableFields } from "./addressRecordFields";
import { RecordImport } from "../../components/RecordImport";
import { DatabaseRecordCollection } from "../../components/DatabaseRecordCollection";
import { addressTableAdapter } from "../database/recordTableAdapters";
import { useAddressRecordActions } from "./useAddressRecordActions";

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
      state: (a, b) => (a.state ?? "").localeCompare(b.state ?? ""),
      country: (a, b) => a.country.localeCompare(b.country),
      status: (a, b) => a.addressStatus.localeCompare(b.addressStatus),
      id: (a, b) => a.id.localeCompare(b.id),
    },
  );
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const detail = useAddressQuery(selectedID);
  const attachment = useAddressAttachmentMutation();
  const patch = useAddressPatchMutation();
  const selectedAddress = detail.data;
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const { publish, importConfig, actions, createForm } = useAddressRecordActions({
    onCreated: setSelectedID,
  });

  return (
    <>
      <div className="content-heading">
        <div>
          <p className="eyebrow">Life-area records</p>
          <h2>Addresses</h2>
          <p className="muted">Read address records and inspect the locations referenced by other Life-area tables.</p>
        </div>
        <div className="button-row">
          <span className="record-count">{records.length} records</span>
          {records.length === 0 && (
            <button type="button" onClick={() => setCreating(true)}>
              Add address
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
          icon="⌂"
          title="No address records"
          description="The Addresses table did not return any records."
        />
      ) : (
        <div className="address-layout">
          <DatabaseRecordCollection
            label="Addresses"
            records={records}
            utilities={utilities}
            adapter={addressTableAdapter}
            sortOptions={[
              { value: "city", label: "City" },
              { value: "type", label: "Address type" },
              { value: "state", label: "State" },
              { value: "country", label: "Country" },
              { value: "status", label: "Status" },
              { value: "id", label: "Record ID" },
            ]}
            filterOptions={Array.from(new Set(records.map((record) => record.addressStatus))).sort()}
            detailId={selectedID}
            onDetailChange={setSelectedID}
            actions={actions}
            onRecordPatch={async (record, field, value) => {
              await patch.mutateAsync({ id: record.id, patch: { [field]: value } as Partial<Address> });
            }}
            detail={
              selectedID ? (
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
              ) : null
            }
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
      <EditableRecordFields className="address-fields" fields={addressEditableFields(record, onPatch)} />
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
