import { useState } from "react";
import {
  useAddressAttachmentMutation,
  useAddressPatchMutation,
  useAddressQuery,
  useCreateAddressMutation,
} from "../../data/recordQueries";
import { useRecordUtilities } from "../../hooks/useRecordUtilities";
import { AttachmentControl } from "../../components/AttachmentControl";
import { DatabaseRecordCollection } from "../../components/DatabaseRecordCollection";
import { EditableRecordFields } from "../../components/EditableRecordFields";
import { QueryFeedback } from "../../components/QueryFeedback";
import { createRecordCreationActions } from "../../components/RecordCreation";
import { RecordPage } from "../../components/RecordPage";
import type { Address } from "../../types";
import { AddressCreateForm } from "../create/RecordCreateForms";
import { addressTableAdapter } from "../database/recordTableAdapters";
import { AddressRecordCreation, AddressFilterOptions, AddressSortOptions } from "./AddressRecordCreation";
import { getAddressDetailFields } from "./AddressDetailsFields";

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
  const create = useCreateAddressMutation();

  const selectedAddress = detail.data;

  const handleImport = async (rows: Record<string, unknown>[]) => {
    for (const row of rows) {
      await create.mutateAsync(row as Parameters<typeof create.mutateAsync>[0]);
    }
  };

  return (
    <RecordPage
      title="Addresses"
      description="Read address records and inspect the locations referenced by other Life-area tables."
      recordCount={records.length}
      recordLabel="address"
      importLabel="addresses"
      expectedColumns={["id", "addressType", "country"]}
      onImport={handleImport}
      emptyIcon="⌂"
      emptyTitle="No address records"
      emptyDescription="The Addresses table did not return any records."
      renderCreateForm={(close) => (
        <AddressCreateForm
          onCancel={close}
          onCreate={async (payload) => {
            const created = await create.mutateAsync(payload);
            setSelectedID(created.id);
            close();
          }}
        />
      )}
    >
      <div className="address-layout">
        <DatabaseRecordCollection
          label="Addresses"
          records={records}
          utilities={utilities}
          adapter={addressTableAdapter}
          sortOptions={AddressSortOptions()}
          filterOptions={AddressFilterOptions(records)}
          detailId={selectedID}
          onDetailChange={setSelectedID}
          actions={createRecordCreationActions({
            recordType: "address",
            importLabel: "addresses",
            expectedColumns: ["id", "addressType", "country"],
            onImport: handleImport,
            renderForm: (close) => (
              <AddressRecordCreation
                close={close}
                onCreate={async (payload) => {
                  const created = await create.mutateAsync(payload);
                  setSelectedID(created.id);
                }}
              />
            ),
          })}
          detail={
            selectedID ? (
              <>
                <QueryFeedback query={detail} />

                {selectedAddress && (
                  <AddressDetail
                    key={selectedAddress.id}
                    record={selectedAddress}
                    onAttachment={async (metadata) => {
                      await attachment.mutateAsync({
                        id: selectedAddress.id,
                        fileID: metadata?.id ?? null,
                      });
                    }}
                    onPatch={async (values) => {
                      await patch.mutateAsync({
                        id: selectedAddress.id,
                        patch: values,
                      });
                    }}
                  />
                )}
              </>
            ) : null
          }
        />
      </div>
    </RecordPage>
  );
}

/** Render the address-specific detail panel while shared field metadata stays in its getter. */
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
      <EditableRecordFields className="address-fields" fields={getAddressDetailFields(record, onPatch)} />
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
