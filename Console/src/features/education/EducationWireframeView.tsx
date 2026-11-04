import type { Education } from "../../types";
import { useEducationPatchMutation } from "../../data/recordQueries";
import { useAddressesQuery } from "../../data/lifeQueries";
import { GemButton } from "../../components/ui/GemButton";
import { educationTableAdapter } from "../database/recordTableAdapters";
import { formatAddress } from "../addresses/formatAddress";
import { WireframeCollectionView } from "../workspace/WireframeCollectionView";
import { WireframeSchemaInspector } from "../workspace/WireframeSchemaInspector";
import { useEducationRecordActions } from "./useEducationRecordActions";
import { educationStatusOptions, educationTypeOptions } from "./educationCreateFields";
import type { RecordPropertyDefinition } from "../../table-kit";

export function EducationWireframeView({ records }: { records: readonly Education[] }) {
  const addressesQuery = useAddressesQuery(true);
  const addresses = addressesQuery.data ?? [];
  const patch = useEducationPatchMutation();
  const recordActions = useEducationRecordActions({ addresses, onCreated: () => undefined });
  const properties: readonly RecordPropertyDefinition<Education>[] = educationTableAdapter
    .getPropertyDefinitions()
    .map((property) =>
      property.id === "locationAddressID"
        ? {
            ...property,
            getValue: (record) => ({
              raw: record.locationAddressID ?? record.address?.id,
              display: formatAddress(
                record.address ?? addresses.find((address) => address.id === record.locationAddressID),
              ),
            }),
          }
        : property,
    );
  const fieldByProperty: Record<string, keyof Education> = {
    institution: "institutionName",
    educationType: "educationType",
    program: "program",
    fieldOfStudy: "fieldOfStudy",
    credential: "credential",
    credentialID: "credentialID",
    startDate: "startDate",
    endDate: "endDate",
    awardedDate: "awardedDate",
    status: "status",
    locationAddressID: "locationAddressID",
    website: "website",
    notes: "notes",
  };
  const addressOptions = addresses.map((address) => ({ value: address.id, label: formatAddress(address) }));

  return (
    <WireframeCollectionView
      config={{
        tableName: "Education",
        title: "Education",
        description: "Education history, institutions, credentials, and related documents.",
        activeCollection: "Education",
        records,
        properties,
        newRecordUtility: recordActions.actions.newRecordUtility,
        searchValues: (record) => [
          record.institutionName,
          record.educationType,
          record.program ?? "",
          record.fieldOfStudy ?? "",
          record.credential ?? "",
          record.status,
          formatAddress(record.address ?? addresses.find((address) => address.id === record.locationAddressID)),
          record.id,
        ],
        cardTitle: (record) => record.institutionName,
        cardSubtitle: (record) => record.educationType,
        cardStatus: (record) => record.status,
        cardMeta: (record) => record.startDate ?? "No start date",
        inspector: (record, schemaProperties) => (
          <>
            <WireframeSchemaInspector
              record={record}
              properties={[
                ...properties.map((property): RecordPropertyDefinition<Education> => {
                  const field = fieldByProperty[property.id];
                  const isAddress = property.id === "locationAddressID";
                  const isSelect = property.id === "educationType" || property.id === "status" || isAddress;
                  const options =
                    property.id === "educationType"
                      ? educationTypeOptions.map(({ value, label }) => ({ value, label }))
                      : property.id === "status"
                        ? educationStatusOptions.map(({ value, label }) => ({ value, label }))
                        : isAddress
                          ? addressOptions
                          : undefined;
                  return {
                    ...property,
                    kind: isSelect ? (property.id === "status" ? "status" : "select") : property.kind,
                    edit: field
                      ? {
                          inputType: isSelect
                            ? "select"
                            : property.kind === "date"
                              ? "date"
                              : property.id === "notes"
                                ? "longText"
                                : "text",
                          nullable: isAddress,
                          options,
                          onSave: async (_source: unknown, value: string | number | null) => {
                            await patch.mutateAsync({
                              id: record.id,
                              patch: { [field]: value === "" ? null : value } as Partial<Education>,
                            });
                          },
                        }
                      : undefined,
                  };
                }),
                ...(schemaProperties ?? []),
              ]}
            />
            <section aria-label="Attachments and page actions">
              <h4>
                Attachments
                <GemButton type="button" variant="outlined" tone="secondary" aria-label="Add attachment">
                  + Add
                </GemButton>
              </h4>
              <ul className="demo-attachments">
                <li>
                  Education document
                  <small>{record.documentFileMetadataID ? "Attached document" : "No document attached"}</small>
                </li>
              </ul>
              <div className="demo-page-actions">
                <GemButton type="button" variant="outlined" tone="secondary">
                  Share
                </GemButton>
              </div>
            </section>
          </>
        ),
      }}
    />
  );
}
