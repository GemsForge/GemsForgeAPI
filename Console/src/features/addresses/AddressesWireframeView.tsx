import type { Address } from "../../types";
import { addressTableAdapter } from "../database/recordTableAdapters";
import { WireframeCollectionView } from "../workspace/WireframeCollectionView";
import { WireframeSchemaInspector } from "../workspace/WireframeSchemaInspector";

export function AddressesWireframeView({ records }: { records: readonly Address[] }) {
  return (
    <WireframeCollectionView
      config={{
        tableName: "Addresses",
        title: "Addresses",
        description: "Places, locations, and address history referenced across your records.",
        activeCollection: "Addresses",
        records,
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
        inspector: (record) => (
          <WireframeSchemaInspector record={record} properties={addressTableAdapter.getPropertyDefinitions()} />
        ),
      }}
    />
  );
}
