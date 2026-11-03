import type { Employment } from "../../types";
import { useEmploymentPatchMutation } from "../../data/recordQueries";
import { employmentTableAdapter } from "../database/recordTableAdapters";
import { WireframeCollectionView } from "../workspace/WireframeCollectionView";
import { WireframeSchemaInspector } from "../workspace/WireframeSchemaInspector";
import { useAddressesQuery } from "../../data/lifeQueries";
import { employmentOptions, toOptions, useEmploymentRecordActions } from "./useEmploymentRecordActions";
import type { RecordPropertyDefinition, RecordSelectOption } from "../../table-kit";

export function EmploymentWireframeView({ records }: { records: readonly Employment[] }) {
  const addresses = useAddressesQuery(true);
  const recordActions = useEmploymentRecordActions({ addresses: addresses.data ?? [], onCreated: () => undefined });
  const patch = useEmploymentPatchMutation();
  const propertyFields: Record<string, keyof Employment> = {
    employer: "employerName",
    employerType: "employerType",
    position: "positionTitle",
    industry: "industry",
    website: "website",
    employmentType: "employmentType",
    startDate: "startDate",
    endDate: "endDate",
    status: "employmentStatus",
    employerContact: "employerContact",
    employerContactNumber: "employerContactNumber",
    employerContactEmail: "employerContactEmail",
    workAddressID: "workAddressID",
    notes: "notes",
  };
  const optionsByProperty: Record<string, RecordSelectOption[]> = {
    employerType: toOptions(employmentOptions.employerType),
    industry: toOptions(employmentOptions.industry),
    employmentType: toOptions(employmentOptions.employmentType),
    status: toOptions(employmentOptions.status),
    workAddressID: (addresses.data ?? []).map((address) => ({
      value: address.id,
      label: [address.addressLine1, address.city, address.state, address.postalCode].filter(Boolean).join(", ") || address.id,
    })),
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
        properties,
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
                property.id === "employerType" || property.id === "industry" || property.id === "employmentType" ||
                property.id === "status" || property.id === "workAddressID";
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
                      nullable: property.id === "workAddressID",
                      options: selectProperty ? optionsByProperty[property.id] : undefined,
                      onSave: (_record: unknown, value: string | number | null) =>
                        patch.mutateAsync({ id: record.id, patch: { [field]: value === "" ? null : value } }).then(() => undefined),
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
