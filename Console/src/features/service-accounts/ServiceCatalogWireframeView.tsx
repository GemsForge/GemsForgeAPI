import type { ServiceAccount } from "../../types";
import type { RecordPropertyDefinition } from "../../table-kit";
import { useServiceAccountPatchMutation } from "../../data/recordQueries";
import { createServiceAccountTableAdapter } from "../database/recordTableAdapters";
import { WireframeCollectionView } from "../workspace/WireframeCollectionView";
import { WireframeSchemaInspector } from "../workspace/WireframeSchemaInspector";

export function ServiceCatalogWireframeView({ records }: { records: readonly ServiceAccount[] }) {
  const patch = useServiceAccountPatchMutation();
  const adapter = createServiceAccountTableAdapter((record) => record.service);
  const fieldByProperty: Record<string, keyof ServiceAccount> = {
    service: "service",
    type: "type",
    group: "expenseGroup",
    monthlyAmount: "monthlyAmount",
    interestRate: "interestRate",
    apr: "apr",
    due: "due",
    occurrence: "occurrence",
    status: "status",
    since: "since",
    website: "website",
    notes: "notes",
    paymentMethod: "paymentMethod",
    accountNumber: "accountNumber",
    emailUpdated: "emailUpdated",
  };
  const properties = adapter
    .getPropertyDefinitions()
    .filter((property) => [...Object.keys(fieldByProperty), "id"].includes(property.id));
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
              properties.map((property) => {
                const field = fieldByProperty[property.id];
                const numeric = ["monthlyAmount", "interestRate", "apr"].includes(property.id);
                return {
                  ...property,
                  kind: numeric ? "number" : property.kind,
                  edit: field
                    ? {
                        inputType: numeric ? "number" : property.kind === "date" ? "date" : "text",
                        onSave: (_record: unknown, value: string | number | null) =>
                          patch
                            .mutateAsync({
                              id: Number(record.id),
                              patch: { [field]: numeric ? (value === "" ? null : Number(value)) : value || null },
                            })
                            .then(() => undefined),
                      }
                    : undefined,
                };
              }) as unknown as readonly RecordPropertyDefinition<typeof record>[]
            }
          />
        ),
      }}
    />
  );
}
