import type { Employment } from "../../types";
import { useEmploymentPatchMutation } from "../../data/recordQueries";
import { employmentTableAdapter } from "../database/recordTableAdapters";
import { WireframeCollectionView } from "../workspace/WireframeCollectionView";
import { WireframeSchemaInspector } from "../workspace/WireframeSchemaInspector";
import { useAddressesQuery } from "../../data/lifeQueries";
import { useEmploymentRecordActions } from "./useEmploymentRecordActions";
import type { RecordPropertyDefinition } from "../../table-kit";

export function EmploymentWireframeView({ records }: { records: readonly Employment[] }) {
  const addresses = useAddressesQuery(true);
  const recordActions = useEmploymentRecordActions({ addresses: addresses.data ?? [], onCreated: () => undefined });
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
  const optionsByProperty = {
    industry: [...new Set(records.map((record) => record.industry).filter((value): value is string => Boolean(value)))],
    employmentType: [...new Set(records.map((record) => record.employmentType))],
    status: [...new Set(records.map((record) => record.employmentStatus))],
  };
  const properties = employmentTableAdapter.getPropertyDefinitions();

  return (
    <WireframeCollectionView
      config={{
        tableName: "Employment",
        title: "Employment",
        description: "Employers, roles, dates, and professional history.",
        activeCollection: "Employment",
        records,
        newRecordUtility: recordActions.actions.newRecordUtility,
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
        inspector: (record, schemaProperties) => (
          <WireframeSchemaInspector
            record={record}
            properties={[...properties.map((property): RecordPropertyDefinition<Employment> => {
              const field = propertyFields[property.id];
              const selectProperty =
                property.id === "industry" || property.id === "employmentType" || property.id === "status";
              return {
                ...property,
                kind: selectProperty ? (property.id === "status" ? "status" : "select") : property.kind,
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
                      onSave: (_record: unknown, value: string | number | null) => save(record, field)(String(value ?? "")),
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
