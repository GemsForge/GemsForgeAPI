import { useState } from "react";
import { api } from "../../api";
import type { Address } from "../../types";
import { AttachmentControl } from "../../components/AttachmentControl";

interface AddressesViewProps {
  records: Address[];
}

export function AddressesView({ records }: AddressesViewProps) {
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);

  async function selectAddress(address: Address) {
    setSelectedAddress(await api.getAddress(address.id));
  }

  return (
    <>
      <div className="content-heading">
        <div>
          <p className="eyebrow">Life-area records</p>
          <h2>Addresses</h2>
          <p className="muted">Read address records and inspect the locations referenced by other Life-area tables.</p>
        </div>
        <span className="record-count">{records.length} records</span>
      </div>

      {records.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">⌂</div><h3>No address records</h3><p>The Addresses table did not return any records.</p></div>
      ) : (
        <div className="address-layout">
          <div className="address-list" aria-label="Address records">
            {records.map((record) => (
              <button className={`address-card ${selectedAddress?.id === record.id ? "selected" : ""}`} key={record.id} onClick={() => void selectAddress(record)}>
                <span className="address-icon">⌂</span>
                <span className="address-card-copy"><strong>{record.city || record.addressType}</strong><small>{record.addressType} · {record.id}</small></span>
                <span className="address-status">{record.addressStatus}</span>
              </button>
            ))}
          </div>
          {selectedAddress ? <AddressDetail record={selectedAddress} onAttachment={async (metadata) => { const updated = await api.patchAddressAttachment(selectedAddress.id, metadata?.id ?? null); setSelectedAddress(updated); }} /> : <div className="detail-placeholder"><span>⌂</span><p>Select an address to view its details.</p></div>}
        </div>
      )}
    </>
  );
}

function AddressDetail({ record, onAttachment }: { record: Address; onAttachment: (metadata: import("../../types").FileMetadata | null) => Promise<void> }) {
  return (
    <article className="address-detail">
      <div className="detail-heading"><div><p className="eyebrow">Address record</p><h3>{record.addressType}</h3><p className="address-code">{record.id}</p></div><span className="status-pill">{record.addressStatus}</span></div>
      <dl className="address-fields">
        <Field label="Address line 1" value={record.addressLine1} />
        <Field label="Address line 2" value={record.addressLine2} />
        <Field label="City" value={record.city} />
        <Field label="State" value={record.state} />
        <Field label="Postal code" value={record.postalCode} />
        <Field label="Country" value={record.country} />
        <Field label="Start date" value={record.startDate} />
        <Field label="End date" value={record.endDate} />
        <div className="address-notes"><dt>Notes</dt><dd>{record.notes || "—"}</dd></div>
      </dl>
      <AttachmentControl fileMetadataID={record.imageFileMetadataID} ownerType="Address" ownerID={record.id} label="Address image" onAttach={onAttachment} />
    </article>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return <div><dt>{label}</dt><dd>{value || "—"}</dd></div>;
}
