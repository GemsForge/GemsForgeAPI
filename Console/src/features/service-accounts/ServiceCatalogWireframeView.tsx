import type { ServiceAccount } from "../../types";
import type { RecordPropertyDefinition } from "../../table-kit";
import { createServiceAccountTableAdapter } from "../database/recordTableAdapters";
import { WireframeCollectionView } from "../workspace/WireframeCollectionView";
import { WireframeSchemaInspector } from "../workspace/WireframeSchemaInspector";

export function ServiceCatalogWireframeView({ records }: { records: readonly ServiceAccount[] }) {
  const adapter = createServiceAccountTableAdapter((record) => record.service);
  return (
    <WireframeCollectionView
      config={{
        tableName: "Services",
        title: "Service Catalog",
        description: "Recurring services, accounts, costs, and renewal details.",
        activeCollection: "Services",
        records: records.map((record) => ({ ...record, id: String(record.id) })),
        searchValues: (record) => [record.service, record.type ?? "", record.expenseGroup ?? "", record.status ?? ""],
        cardTitle: (record) => record.service,
        cardSubtitle: (record) => record.type ?? "Service account",
        cardStatus: (record) => record.status ?? "No status",
        cardMeta: (record) =>
          record.monthlyAmount == null ? "No monthly amount" : `$${record.monthlyAmount.toFixed(2)} / month`,
        inspector: (record) => (
          <WireframeSchemaInspector
            record={record}
            properties={
              adapter.getPropertyDefinitions() as unknown as readonly RecordPropertyDefinition<typeof record>[]
            }
          />
        ),
      }}
    />
  );
}
