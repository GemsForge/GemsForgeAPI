import { useEffect, useRef, useState } from "react";
import {
  useAddressAttachmentMutation,
  useAddressPatchMutation,
  useAddressQuery,
  useCreateAddressMutation,
} from "../../data/recordQueries";
import { useRecordUtilities } from "../../hooks/useRecordUtilities";
import { DatabaseRecordCollection } from "../../components/DatabaseRecordCollection";
import { QueryFeedback } from "../../components/QueryFeedback";
import { createRecordCreationActions } from "../../components/RecordCreation";
import { RecordPage } from "../../components/RecordPage";
import type { Address } from "../../types";
import { AddressCreateForm } from "../create/RecordCreateForms";
import { addressTableAdapter } from "../database/recordTableAdapters";
import { AddressRecordCreation, AddressFilterOptions, AddressSortOptions } from "./AddressRecordCreation";
import { getAddressDetailFields } from "./AddressDetailsFields";
import { RecordDetail } from "../create/RecordEditForm";

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
  const detailDialogRef = useRef<HTMLDialogElement>(null);

  const detail = useAddressQuery(selectedID);
  const attachment = useAddressAttachmentMutation();
  const patch = useAddressPatchMutation();
  const create = useCreateAddressMutation();

  const selectedAddress = detail.data;

  useEffect(() => {
    if (selectedAddress) {
      detailDialogRef.current?.showModal();
    } else if (detailDialogRef.current?.open) {
      detailDialogRef.current.close();
    }
  }, [selectedAddress]);

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
        />
      </div>
      <dialog
        ref={detailDialogRef}
        aria-labelledby="address-detail-title"
        onCancel={(event) => {
          event.preventDefault();
          setSelectedID(null);
        }}
      >
        {selectedAddress && (
          <>
            <div className="dialog-heading">
              <h2 id="address-detail-title">Address details</h2>
              <button type="button" onClick={() => setSelectedID(null)} aria-label="Close address details">
                ×
              </button>
            </div>
            <QueryFeedback query={detail} />
            <RecordDetail
              key={selectedAddress.id}
              recordType="Address"
              title={selectedAddress.addressType}
              recordId={selectedAddress.id}
              status={selectedAddress.addressStatus}
              fields={getAddressDetailFields(selectedAddress, async (values) => {
                await patch.mutateAsync({ id: selectedAddress.id, patch: values });
              })}
              fileMetadataID={selectedAddress.imageFileMetadataID}
              onAttachment={async (metadata) => {
                await attachment.mutateAsync({
                  id: selectedAddress.id,
                  fileID: metadata?.id ?? null,
                });
              }}
            />
          </>
        )}
      </dialog>
    </RecordPage>
  );
}
