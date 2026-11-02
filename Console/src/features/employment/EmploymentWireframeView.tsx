import type { Employment } from "../../types";
import { useEmploymentPatchMutation } from "../../data/recordQueries";
import { employmentTableAdapter } from "../database/recordTableAdapters";
import { WireframeCollectionView } from "../workspace/WireframeCollectionView";
import { WireframeSchemaInspector } from "../workspace/WireframeSchemaInspector";

export function EmploymentWireframeView({ records }: { records: readonly Employment[] }) {
  const patch = useEmploymentPatchMutation();
  const save = (record: Employment, field: keyof Employment) => (value: string) =>
    patch.mutateAsync({ id: record.id, patch: { [field]: value || null } }).then(() => undefined);
  const propertyFields: Record<string, keyof Employment> = {
    employer: "employerName",
    position: "positionTitle",
    industry: "industry",
    employmentType: "employmentType",
    startDate: "startDate",
    endDate: "endDate",
    status: "employmentStatus",
    notes: "notes",
  };
  const properties = employmentTableAdapter.getPropertyDefinitions().filter((property) => propertyFields[property.id]);

  return (
    <WireframeCollectionView
      config={{
        tableName: "Employment",
        title: "Employment",
        description: "Employers, roles, dates, and professional history.",
        activeCollection: "Employment",
        records,
        searchValues: (record) => [
          record.employerName,
          record.positionTitle,
          record.industry ?? "",
          record.employmentStatus,
        ],
        cardTitle: (record) => record.employerName,
        cardSubtitle: (record) => record.positionTitle,
        cardStatus: (record) => record.employmentStatus,
        cardMeta: (record) => record.startDate ?? "No start date",
        inspector: (record) => (
          <WireframeSchemaInspector
            record={record}
            properties={properties.map((property) => ({
              ...property,
              edit: {
                inputType: property.kind === "date" ? "date" : property.id === "notes" ? "longText" : "text",
                onSave: (_record, value) => save(record, propertyFields[property.id])(String(value ?? "")),
              },
            }))}
          />
        ),
      }}
    />
  );
}
