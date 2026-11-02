import { useEffect, useState } from "react";
import type { ServiceAccount } from "../../types";
import { api } from "../../api";
import { useServiceLogosQuery } from "../../data/lifeQueries";
import type { RecordPropertyDefinition } from "../../table-kit";
import { useServiceAccountPatchMutation } from "../../data/recordQueries";
import { createServiceAccountTableAdapter } from "../database/recordTableAdapters";
import { WireframeCollectionView } from "../workspace/WireframeCollectionView";
import { WireframeSchemaInspector } from "../workspace/WireframeSchemaInspector";
import { WireframeImagePreview } from "../workspace/WireframeImagePreview";

export function ServiceCatalogWireframeView({ records }: { records: readonly ServiceAccount[] }) {
  const patch = useServiceAccountPatchMutation();
  const logos = useServiceLogosQuery(true);
  const [logoURLs, setLogoURLs] = useState<Record<number, string>>({});
  useEffect(() => {
    const controller = new AbortController();
    const objectURLs: string[] = [];
    void Promise.all((logos.data ?? []).map(async (logo) => {
      try {
        const blob = await api.getServiceLogoImage(logo.id, controller.signal);
        const url = URL.createObjectURL(blob);
        objectURLs.push(url);
        return [logo.id, url] as const;
      } catch { return null; }
    })).then((entries) => setLogoURLs(Object.fromEntries(entries.filter((entry): entry is readonly [number, string] => entry !== null))));
    return () => { controller.abort(); objectURLs.forEach((url) => URL.revokeObjectURL(url)); };
  }, [logos.data]);
  const adapter = createServiceAccountTableAdapter((record) => {
    const logo = logos.data?.find((item) => item.logoKey === record.logoKey);
    const src = logo ? logoURLs[logo.id] : undefined;
    return src ? <WireframeImagePreview src={src} alt={`${record.service} logo`} /> : "No image";
  }, (record) => {
    const logo = logos.data?.find((item) => item.logoKey === record.logoKey);
    const src = logo ? logoURLs[logo.id] : undefined;
    return src ? { src, alt: `${record.service} logo`, fit: "contain" } : undefined;
  });
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
    .filter((property) => [...Object.keys(fieldByProperty), "id", "logo"].includes(property.id));
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
        cardImage: (record) => {
          const logo = logos.data?.find((item) => item.logoKey === record.logoKey);
          const src = logo ? logoURLs[logo.id] : undefined;
          return src ? { src, alt: `${record.service} logo` } : undefined;
        },
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
