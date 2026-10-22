// Console/src/features/addresses/AddressRecordCreation.tsx
import type { Address, AddressCreate } from "../../types";
import { AddressCreateForm } from "../create/RecordCreateForms";

interface AddressRecordCreationProps {
  close: () => void;
  onCreate: (payload: AddressCreate) => Promise<void>;
}

export const AddressSortOptions = () => {
  return [
    { value: "city", label: "City" },
    { value: "type", label: "Address type" },
    { value: "state", label: "State" },
    { value: "country", label: "Country" },
    { value: "status", label: "Status" },
    { value: "id", label: "Record ID" },
  ];
};

export function AddressRecordCreation({ close, onCreate }: AddressRecordCreationProps) {
  return (
    <AddressCreateForm
      onCancel={close}
      onCreate={async (payload) => {
        await onCreate(payload);
        close();
      }}
    />
  );
}

export const AddressFilterOptions = (records: Address[]) => {
  return Array.from(new Set(records.map((record) => record.addressStatus))).sort();
};
