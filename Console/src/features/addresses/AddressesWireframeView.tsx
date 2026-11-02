import type { Address } from "../../types";
import { useAddressPatchMutation } from "../../data/recordQueries";
import { addressTableAdapter } from "../database/recordTableAdapters";
import { WireframeCollectionView } from "../workspace/WireframeCollectionView";
import { WireframeSchemaInspector } from "../workspace/WireframeSchemaInspector";
import { useAddressRecordActions } from "./useAddressRecordActions";
import type { RecordPropertyDefinition } from "../../table-kit";

export function AddressesWireframeView({ records }: { records: readonly Address[] }) {
  const recordActions = useAddressRecordActions({ onCreated: () => undefined });
  const patch = useAddressPatchMutation();
  const fieldByProperty: Record<string, keyof Address> = {
    addressType: "addressType",
    addressLine1: "addressLine1",
    addressLine2: "addressLine2",
    city: "city",
    state: "state",
    postalCode: "postalCode",
    country: "country",
    startDate: "startDate",
    endDate: "endDate",
    addressStatus: "addressStatus",
    notes: "notes",
  };
  const optionsByProperty = {
    addressType: [...new Set(records.map((record) => record.addressType))],
    addressStatus: [...new Set(records.map((record) => record.addressStatus))],
  };
  const properties = addressTableAdapter.getPropertyDefinitions();
  return (
    <WireframeCollectionView
      config={{
        tableName: "Addresses",
        title: "Addresses",
        description: "Places, locations, and address history referenced across your records.",
        activeCollection: "Addresses",
        records,
        newRecordUtility: recordActions.actions.newRecordUtility,
        searchValues: (record) => [
          record.addressLine1 ?? "",
          record.city ?? "",
          record.state ?? "",
          record.country,
          record.addressType,
          record.addressStatus,
        ],
        cardTitle: (record) => record.city ?? record.addressLine1 ?? record.id,
        cardSubtitle: (record) => `${record.addressType} · ${record.state ?? record.country}`,
        cardStatus: (record) => record.addressStatus,
        cardMeta: (record) => record.startDate ?? "No start date",
        inspector: (record, schemaProperties) => (
          <WireframeSchemaInspector
            record={record}
            properties={[...properties.map((property): RecordPropertyDefinition<Address> => {
              const field = fieldByProperty[property.id];
              const selectProperty = property.id === "addressType" || property.id === "addressStatus";
              return {
                ...property,
                kind: selectProperty ? (property.id === "addressStatus" ? "status" : "select") : property.kind,
                edit: field
                  ? {
                      inputType: selectProperty
                        ? "select"
                        : property.kind === "date"
                          ? "date"
                          : property.id === "notes"
                            ? "longText"
                            : "text",
                      options: selectProperty
                        ? optionsByProperty[property.id as keyof typeof optionsByProperty].map((value) => ({
                            value,
                            label: value,
                          }))
                        : undefined,
                      onSave: (_record: unknown, value: string | number | null) =>
                        patch.mutateAsync({ id: record.id, patch: { [field]: value || null } }).then(() => undefined),
                    }
                  : undefined,
              };
            }), ...(schemaProperties ?? [])]}
          />
        ),
      }}
    />
  );
}
