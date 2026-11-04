import type { Address } from "../../types";
import { useAddressPatchMutation, useAddressQuery } from "../../data/recordQueries";
import { QueryFeedback } from "../../components/QueryFeedback";
import { addressTableAdapter } from "../database/recordTableAdapters";
import { WireframeCollectionView } from "../workspace/WireframeCollectionView";
import { WireframeSchemaInspector } from "../workspace/WireframeSchemaInspector";
import { useAddressRecordActions } from "./useAddressRecordActions";
import type { RecordPropertyDefinition, RecordSelectOption } from "../../table-kit";

export function AddressesWireframeView({ records }: { records: readonly Address[] }) {
  const recordActions = useAddressRecordActions({ onCreated: () => undefined });
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
        properties,
        newRecordUtility: recordActions.actions.newRecordUtility,
        searchValues: (record) => [
          record.addressLine1 ?? "",
          record.city ?? "",
          record.state ?? "",
          record.country,
          record.addressType,
          record.addressStatus,
        ],
        cardTitle: (record) =>
          record.addressLine1?.trim() || addressTableAdapter.toTableRecord(record, 0).title || record.id,
        cardSubtitle: (record) =>
          [record.city, record.state, record.postalCode, record.country].filter(Boolean).join(", ") ||
          record.addressType,
        cardStatus: (record) => record.addressStatus,
        cardMeta: (record) => record.startDate ?? "No start date",
        inspector: (record, schemaProperties) => (
          <AddressWireframeInspector
            record={record}
            properties={properties}
            schemaProperties={schemaProperties}
            optionsByProperty={optionsByProperty}
          />
        ),
      }}
    />
  );
}

function AddressWireframeInspector({
  record,
  properties,
  schemaProperties,
  optionsByProperty,
}: {
  record: Address;
  properties: readonly RecordPropertyDefinition<Address>[];
  schemaProperties?: readonly RecordPropertyDefinition<Address>[];
  optionsByProperty: { addressType: string[]; addressStatus: string[] };
}) {
  const detail = useAddressQuery(record.id);
  const patch = useAddressPatchMutation();
  if (!detail.data) return <QueryFeedback query={detail} />;

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
  const inspectorProperties = properties.map((property): RecordPropertyDefinition<Address> => {
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
            nullable:
              property.id === "addressLine1" ||
              property.id === "addressLine2" ||
              property.id === "postalCode" ||
              property.id === "notes",
            options: selectProperty
              ? optionsByProperty[property.id as keyof typeof optionsByProperty].map((value): RecordSelectOption => ({
                  value,
                  label: value,
                }))
              : undefined,
            onSave: (_source: unknown, value: string | number | null) =>
              patch
                .mutateAsync({
                  id: detail.data.id,
                  patch: { [field]: value === "" ? null : value },
                })
                .then(() => undefined),
          }
        : undefined,
    };
  });

  return (
    <WireframeSchemaInspector record={detail.data} properties={[...inspectorProperties, ...(schemaProperties ?? [])]} />
  );
}
