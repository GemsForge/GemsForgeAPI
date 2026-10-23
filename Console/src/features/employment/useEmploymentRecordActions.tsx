import type { TableActionsProps } from "../../table-kit";
import type { ReactNode } from "react";
import { createRecordImportActions } from "../../components/createRecordImportActions";
import { EmploymentCreateForm } from "../create/RecordCreateForms";
import { useCreateEmploymentMutation } from "../../data/recordQueries";

export const employmentOptions = {
  industry: ["Technology", "Healthcare", "Education", "Finance", "Government", "Retail", "Hospitality", "Manufacturing", "Other"],
  employerType: ["Company", "Nonprofit", "Government", "Self-employed", "Other"],
  employmentType: ["Full-time", "Part-time", "Contract", "Temporary", "Internship", "Self-employed", "Other"],
  status: ["Current", "Former", "On leave", "Seasonal"],
};

export const toOptions = (values: string[]) => values.map((value) => ({ value, label: value }));

interface EmploymentRecordActionsOptions {
  /** Addresses available to the employment form. */
  addresses: import("../../types").Address[];
  /** Selects a newly created employment record in the feature view. */
  onCreated: (id: string) => void;
}

interface EmploymentRecordActionsResult {
  create: ReturnType<typeof useCreateEmploymentMutation>;
  publish: (rows: Record<string, unknown>[]) => Promise<void>;
  actions: TableActionsProps;
  createForm: (onCancel: () => void) => ReactNode;
}

/**
 * Compose Employment-owned create and intake actions for the shared Table Kit.
 * The hook owns feature behavior; the table owns only menu structure and UI.
 */
export function useEmploymentRecordActions({
  addresses,
  onCreated,
}: EmploymentRecordActionsOptions): EmploymentRecordActionsResult {
  const create = useCreateEmploymentMutation();
  const publish = async (rows: Record<string, unknown>[]) => {
    for (const row of rows) await create.mutateAsync(row as Parameters<typeof create.mutateAsync>[0]);
  };
  const formProps = {
    addresses,
    employerTypeOptions: toOptions(employmentOptions.employerType),
    industryOptions: toOptions(employmentOptions.industry),
    employmentTypeOptions: toOptions(employmentOptions.employmentType),
    statusOptions: toOptions(employmentOptions.status),
  };
  const createForm = (onCancel: () => void) => (
    <EmploymentCreateForm
      {...formProps}
      onCancel={onCancel}
      onCreate={async (payload) => {
        const created = await create.mutateAsync(payload);
        onCreated(created.id);
        onCancel();
      }}
    />
  );

  return {
    create,
    publish,
    createForm,
    actions: {
      newRecordUtility: {
        options: [
          {
            id: "new-employment",
            label: "Input Form",
            description: "Open the employment form.",
            render: ({ close }) => createForm(close),
          },
          ...createRecordImportActions({
            idPrefix: "employment",
            label: "employment records",
            expectedColumns: ["id", "employerName", "employerType", "positionTitle", "employmentType", "employmentStatus"],
            onPublish: publish,
          }),
        ],
      },
    },
  };
}
