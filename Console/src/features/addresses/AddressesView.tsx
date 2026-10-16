import { usePagedRecords } from "../../hooks/usePagedRecords";
import { PaginationControls } from "../../components/PaginationControls";
import { useState } from "react";
import { useAddressQuery, useAddressAttachmentMutation, useAddressPatchMutation } from "../../data/recordQueries";
import { QueryFeedback } from "../../components/QueryFeedback";
import type { Address } from "../../types";
import { AttachmentControl } from "../../components/AttachmentControl";
import { GemEmptyState, GemRecordCard, GemRecordList } from "../../components/ui";

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

  return (
    <>
      <PaginationControls {...paging} label="Addresses" />
      <div className="content-heading">
        <div>
          <p className="eyebrow">Life-area records</p>
          <h2>Addresses</h2>
          <p className="muted">Read address records and inspect the locations referenced by other Life-area tables.</p>
        </div>
        <span className="record-count">{records.length} records</span>
      </div>

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
  const [editing, setEditing] = useState(false);
  const [city, setCity] = useState(record.city ?? "");
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
      {editing ? (
        <form
          className="edit-form"
          onSubmit={async (event) => {
            event.preventDefault();
            await onPatch({ city });
            setEditing(false);
          }}
        >
          <label>
            City
            <input value={city} onChange={(event) => setCity(event.target.value)} />
          </label>
          <button type="submit">Save city</button>
          <button
            type="button"
            onClick={() => {
              setCity(record.city ?? "");
              setEditing(false);
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setEditing(true)}>
          Edit city
        </button>
      )}
      <dl className="address-fields">
        <Field label="Address line 1" value={record.addressLine1} />
        <Field label="Address line 2" value={record.addressLine2} />
        <Field label="City" value={record.city} />
        <Field label="State" value={record.state} />
        <Field label="Postal code" value={record.postalCode} />
        <Field label="Country" value={record.country} />
        <Field label="Start date" value={record.startDate} />
        <Field label="End date" value={record.endDate} />
        <div className="address-notes">
          <dt>Notes</dt>
          <dd>{record.notes || "—"}</dd>
        </div>
      </dl>
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

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}
