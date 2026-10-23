import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, type ReactNode } from "react";
import {
  Controller,
  useForm,
  type Control,
  type DefaultValues,
  type FieldValues,
  type Path,
  type Resolver,
  type UseFormReturn,
} from "react-hook-form";
import { z } from "zod";
import {
  CreateFormFrame,
  CreateSearchableSelectField,
  CreateSelectField,
  CreateTextField,
  type CreateFieldWidth,
} from "../../components/forms/CreateForm";
import {
  GeoapifyAddressSearch,
  type AddressSearchValues,
  type GeoapifySearchClient,
} from "../addresses/GeoapifyAddressSearch";
import { useExpenseCategoriesQuery, useExpenseSubcategoriesQuery } from "../../data/lifeQueries";
import type {
  Address,
  AddressCreate,
  DomainCreate,
  EducationCreate,
  EmploymentCreate,
  ServiceAccountCreate,
  TransactionCreate,
} from "../../types";
import {
  addressFieldDefinitions,
  addressSchema,
  type AddressFieldDefinition,
  type AddressCreateFormValues,
} from "../addresses/addressCreateFields";
import {
  educationFieldDefinitions,
  educationSchema,
  type EducationCreateFormValues,
} from "../education/educationCreateFields";
import {
  createEmploymentFieldDefinitions,
  createEmploymentSchema,
  type EmploymentCreateFormValues,
  type EmploymentFieldDefinition,
} from "../employment/employmentCreateFields";
import {
  createTransactionFieldDefinitions,
  createTransactionSchema,
  type TransactionCreateFormValues,
} from "../transactions/transactionCreateFields";

const required = (label: string) => z.string().trim().min(1, `${label} is required.`);
const optional = z.string();
const optionalNumber = z
  .string()
  .refine(
    (value) => value === "" || (/^\d+(\.\d+)?$/.test(value) && Number(value) >= 0),
    "Enter a non-negative number.",
  );
const transactionFieldDefinitions = createTransactionFieldDefinitions({ categories: [], subcategories: [] });
const transactionSchema = createTransactionSchema(transactionFieldDefinitions);
const serviceSchema = z.object({
  service: required("Service name"),
  type: optional,
  expenseGroup: optional,
  monthlyAmount: optionalNumber,
  interestRate: optionalNumber,
  apr: optionalNumber,
  due: optional,
  occurrence: optional,
  status: optional,
  since: optional,
  website: optional,
  notes: optional,
  paymentMethod: optional,
  accountNumber: optional,
  associatedAddress: optional,
  serviceKey: optional,
});
const domainSchema = z.object({ id: optional, title: required("Title"), description: required("Description") });

function FormShell<T extends FieldValues>({
  title,
  schema,
  defaultValues,
  onCreate,
  onCancel,
  children,
}: {
  title: string;
  schema: z.ZodType<T>;
  defaultValues: T;
  onCreate: (values: T) => Promise<void>;
  onCancel: () => void;
  children: (form: UseFormReturn<T>) => ReactNode;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<T, unknown, T>({
    resolver: zodResolver(schema as never) as Resolver<T>,
    defaultValues: defaultValues as DefaultValues<T>,
  });
  return (
    <CreateFormFrame
      title={title}
      submitting={form.formState.isSubmitting}
      error={serverError}
      onCancel={onCancel}
      onSubmit={form.handleSubmit(async (values) => {
        setServerError(null);
        try {
          await onCreate(values);
        } catch (error) {
          setServerError(
            error instanceof Error ? error.message : "Could not create this record. Correct any issues and try again.",
          );
        }
      })}
    >
      {children(form)}
    </CreateFormFrame>
  );
}

function Text<T extends FieldValues>({
  form,
  name,
  label,
  required: isRequired = false,
  type = "text",
  multiline = false,
  placeholder,
  width = "long",
}: {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
  required?: boolean;
  type?: string;
  multiline?: boolean;
  placeholder?: string;
  width?: CreateFieldWidth;
}) {
  const message = form.formState.errors[name]?.message;
  return (
    <CreateTextField
      label={label}
      registration={form.register(name)}
      required={isRequired}
      type={type}
      multiline={multiline}
      placeholder={placeholder}
      width={width}
      error={typeof message === "string" ? message : undefined}
    />
  );
}
function Select<T extends FieldValues>({
  form,
  name,
  label,
  options,
  required = false,
  searchable = false,
  searchPlaceholder,
}: {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const message = form.formState.errors[name]?.message;
  return (
    <Controller
      control={form.control as Control<T>}
      name={name}
      render={({ field }) =>
        searchable ? (
          <CreateSearchableSelectField
            label={label}
            name={field.name}
            value={String(field.value ?? "")}
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            options={options}
            required={required}
            searchPlaceholder={searchPlaceholder}
            error={typeof message === "string" ? message : undefined}
          />
        ) : (
          <CreateSelectField
            label={label}
            name={field.name}
            value={String(field.value ?? "")}
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            options={options}
            required={required}
            error={typeof message === "string" ? message : undefined}
          />
        )
      }
    />
  );
}

function renderAddressField(form: UseFormReturn<AddressCreateFormValues>, field: AddressFieldDefinition) {
  if (field.kind === "select") {
    return (
      <Select
        key={field.name}
        form={form}
        name={field.name}
        label={field.label}
        options={[...field.options]}
        required={field.required}
      />
    );
  }
  return (
    <Text
      key={field.name}
      form={form}
      name={field.name}
      label={field.label}
      required={field.required}
      type={field.type}
      multiline={field.multiline}
      width={field.width}
      placeholder={field.placeholder}
    />
  );
}

function addressField(name: keyof AddressCreateFormValues): AddressFieldDefinition {
  const definition = addressFieldDefinitions.find((field) => field.name === name);
  if (!definition) throw new Error(`Missing Address field definition: ${name}`);
  return definition;
}

function renderEducationField(form: UseFormReturn<EducationCreateFormValues>, field: EducationFieldDefinition) {
  return field.options ? (
    <Select key={field.name} form={form} name={field.name} label={field.label} options={[...field.options]} required={field.required} />
  ) : (
    <Text
      key={field.name}
      form={form}
      name={field.name}
      label={field.label}
      required={field.required}
      type={field.type}
      multiline={field.multiline}
      width={field.width}
    />
  );
}

function renderEmploymentField(form: UseFormReturn<EmploymentCreateFormValues>, field: EmploymentFieldDefinition) {
  return field.options ? (
    <Select
      key={field.name}
      form={form}
      name={field.name}
      label={field.label}
      options={[...field.options]}
      required={field.required}
      searchable={field.name === "workAddressID"}
      searchPlaceholder={field.name === "workAddressID" ? "Search existing addresses" : undefined}
    />
  ) : (
    <Text key={field.name} form={form} name={field.name} label={field.label} required={field.required} type={field.type} multiline={field.multiline} width={field.width} />
  );
}

function employmentField(fields: readonly EmploymentFieldDefinition[], name: keyof EmploymentCreateFormValues) {
  const definition = fields.find((field) => field.name === name);
  if (!definition) throw new Error(`Missing Employment field definition: ${name}`);
  return definition;
}

function renderTransactionField(form: UseFormReturn<TransactionCreateFormValues>, field: import("../transactions/transactionCreateFields").TransactionFieldDefinition) {
  return field.options ? (
    <Select key={field.name} form={form} name={field.name} label={field.label} options={[...field.options]} required={field.required} />
  ) : (
    <Text key={field.name} form={form} name={field.name} label={field.label} required={field.required} type={field.type} multiline={field.multiline} width={field.width} />
  );
}

function fields<T extends FieldValues>(form: UseFormReturn<T>, definitions: Array<[Path<T>, string, boolean?]>) {
  return definitions.map(([name, label, requiredField]) => (
    <Text key={name} form={form} name={name} label={label} required={requiredField} />
  ));
}

/** Generate the stable EmploymentID required by the existing API without exposing it as form input. */
function createEmploymentID(): string {
  return `EMP-${crypto.randomUUID()}`;
}

export function DomainCreateForm({
  onCreate,
  onCancel,
}: {
  onCreate: (payload: DomainCreate) => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <FormShell
      title="Create domain"
      schema={domainSchema}
      defaultValues={{ id: "", title: "", description: "" }}
      onCreate={async ({ id, title, description }) =>
        onCreate({ ...(id.trim() ? { id: id.trim() } : {}), title, description })
      }
      onCancel={onCancel}
    >
      {(form) => (
        <>
          {fields(form, [
            ["id", "Stable ID (optional)"],
            ["title", "Title", true],
            ["description", "Description", true],
          ])}
        </>
      )}
    </FormShell>
  );
}

export function AddressCreateForm({
  onCreate,
  onCancel,
  addressSearchClient,
}: {
  onCreate: (payload: AddressCreate) => Promise<void>;
  onCancel: () => void;
  addressSearchClient?: GeoapifySearchClient;
}) {
  return (
    <FormShell
      title="Create address"
      schema={addressSchema}
      defaultValues={{
        addressType: "Residence",
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        postalCode: "",
        country: "US",
        startDate: "",
        endDate: "",
        addressStatus: "Current",
        notes: "",
      }}
      onCreate={async (v) =>
        onCreate({
          addressType: v.addressType,
          addressLine1: blank(v.addressLine1),
          addressLine2: blank(v.addressLine2),
          city: blank(v.city),
          state: blank(v.state),
          postalCode: blank(v.postalCode),
          country: v.country,
          startDate: blank(v.startDate),
          endDate: blank(v.endDate),
          addressStatus: v.addressStatus,
          notes: blank(v.notes),
        })
      }
      onCancel={onCancel}
    >
      {(form) => {
        function applyAddress(values: AddressSearchValues) {
          if (values.addressLine1) form.setValue("addressLine1", values.addressLine1, { shouldDirty: true });
          if (values.city) form.setValue("city", values.city, { shouldDirty: true });
          if (values.state) form.setValue("state", values.state, { shouldDirty: true });
          if (values.postalCode) form.setValue("postalCode", values.postalCode, { shouldDirty: true });
          if (values.country) form.setValue("country", values.country, { shouldDirty: true });
        }

        return (
          <>
            <GeoapifyAddressSearch onSelect={applyAddress} client={addressSearchClient} />
            <div className="create-form-grid">
              {renderAddressField(form, addressField("addressType"))}
              {renderAddressField(form, addressField("addressLine1"))}
              {renderAddressField(form, addressField("addressLine2"))}
              {renderAddressField(form, addressField("country"))}
            </div>
            <div className="create-form-grid create-form-grid--address-location">
              {renderAddressField(form, addressField("city"))}
              {renderAddressField(form, addressField("state"))}
              {renderAddressField(form, addressField("postalCode"))}
            </div>
            <div className="create-form-grid create-form-grid--compact">
              {renderAddressField(form, addressField("startDate"))}
              {renderAddressField(form, addressField("endDate"))}
              {renderAddressField(form, addressField("addressStatus"))}
            </div>
            {renderAddressField(form, addressField("notes"))}
          </>
        );
      }}
    </FormShell>
  );
}

export function EducationCreateForm({
  addresses,
  onCreate,
  onCancel,
}: {
  addresses: Address[];
  onCreate: (payload: EducationCreate) => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <FormShell
      title="Create education record"
      schema={educationSchema}
      defaultValues={{
        id: "",
        educationType: "",
        institutionName: "",
        program: "",
        fieldOfStudy: "",
        credential: "",
        credentialID: "",
        startDate: "",
        endDate: "",
        awardedDate: "",
        status: "Completed",
        locationAddressID: "",
        website: "",
        notes: "",
      }}
      onCreate={async (v) =>
        onCreate({
          ...v,
          id: v.id.trim(),
          locationAddressID: blank(v.locationAddressID),
          program: blank(v.program),
          fieldOfStudy: blank(v.fieldOfStudy),
          credential: blank(v.credential),
          credentialID: blank(v.credentialID),
          startDate: blank(v.startDate),
          endDate: blank(v.endDate),
          awardedDate: blank(v.awardedDate),
          website: blank(v.website),
          notes: blank(v.notes),
        })
      }
      onCancel={onCancel}
    >
      {(form) => (
        <>
          {educationFieldDefinitions.map((field) => renderEducationField(form, field))}
          <Select
            form={form}
            name="locationAddressID"
            label="Location address"
            options={addresses.map((a) => ({
              value: a.id,
              label: [a.addressType, a.city, a.id].filter(Boolean).join(" · "),
            }))}
          />
        </>
      )}
    </FormShell>
  );
}

/** Render an employment create form with parent-supplied classification options. */
export function EmploymentCreateForm({
  addresses,
  employerTypeOptions,
  industryOptions,
  employmentTypeOptions,
  statusOptions,
  onCreate,
  onCancel,
}: {
  addresses: Address[];
  employerTypeOptions: Array<{ value: string; label: string }>;
  industryOptions: Array<{ value: string; label: string }>;
  employmentTypeOptions: Array<{ value: string; label: string }>;
  statusOptions: Array<{ value: string; label: string }>;
  onCreate: (payload: EmploymentCreate) => Promise<void>;
  onCancel: () => void;
}) {
  const [generatedID] = useState(createEmploymentID);
  const employmentFields = createEmploymentFieldDefinitions({
    employerType: employerTypeOptions,
    industry: industryOptions,
    employmentType: employmentTypeOptions,
    status: statusOptions,
    workAddress: addresses.map((a) => ({ value: a.id, label: [a.addressType, a.city, a.id].filter(Boolean).join(" · ") })),
  });
  const schema = createEmploymentSchema(employmentFields);

  return (
    <FormShell
      title="Create employment record"
      schema={schema}
      defaultValues={{
        id: generatedID,
        employerName: "",
        employerType: "",
        industry: "",
        website: "",
        positionTitle: "",
        employmentType: "",
        startDate: "",
        endDate: "",
        employmentStatus: "Current",
        workAddressID: "",
        employerContact: "",
        employerContactNumber: "",
        employerContactEmail: "",
        notes: "",
      }}
      onCreate={async (v) =>
        onCreate({
          ...v,
          id: v.id.trim(),
          industry: blank(v.industry),
          website: blank(v.website),
          startDate: blank(v.startDate),
          endDate: blank(v.endDate),
          workAddressID: blank(v.workAddressID),
          employerContact: blank(v.employerContact),
          employerContactNumber: blank(v.employerContactNumber),
          employerContactEmail: blank(v.employerContactEmail),
          notes: blank(v.notes),
        })
      }
      onCancel={onCancel}
    >
      {(form) => (
        <>
          <div className="create-form-grid">
            {renderEmploymentField(form, employmentField(employmentFields, "employerName"))}
            {renderEmploymentField(form, employmentField(employmentFields, "employerType"))}
          </div>
          <div className="create-form-grid">
            {renderEmploymentField(form, employmentField(employmentFields, "industry"))}
            {renderEmploymentField(form, employmentField(employmentFields, "website"))}
          </div>
          <div className="create-form-grid">
            {renderEmploymentField(form, employmentField(employmentFields, "positionTitle"))}
            {renderEmploymentField(form, employmentField(employmentFields, "employmentType"))}
          </div>
          <div className="create-form-grid create-form-grid--compact">
            {renderEmploymentField(form, employmentField(employmentFields, "startDate"))}
            {renderEmploymentField(form, employmentField(employmentFields, "endDate"))}
            {renderEmploymentField(form, employmentField(employmentFields, "employmentStatus"))}
          </div>
          <div className="create-form-grid create-form-grid--contact">
            {renderEmploymentField(form, employmentField(employmentFields, "employerContact"))}
            {renderEmploymentField(form, employmentField(employmentFields, "employerContactNumber"))}
            {renderEmploymentField(form, employmentField(employmentFields, "employerContactEmail"))}
          </div>
          {renderEmploymentField(form, employmentField(employmentFields, "notes"))}
          {renderEmploymentField(form, employmentField(employmentFields, "workAddressID"))}
        </>
      )}
    </FormShell>
  );
}

export function ServiceAccountCreateForm({
  onCreate,
  onCancel,
}: {
  onCreate: (payload: ServiceAccountCreate) => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <FormShell
      title="Create service account"
      schema={serviceSchema}
      defaultValues={{
        service: "",
        type: "",
        expenseGroup: "",
        monthlyAmount: "",
        interestRate: "",
        apr: "",
        due: "",
        occurrence: "",
        status: "",
        since: "",
        website: "",
        notes: "",
        paymentMethod: "",
        accountNumber: "",
        associatedAddress: "",
        serviceKey: "",
      }}
      onCreate={async (v) =>
        onCreate({
          service: v.service,
          type: blank(v.type),
          expenseGroup: blank(v.expenseGroup),
          monthlyAmount: numberOrNull(v.monthlyAmount),
          interestRate: numberOrNull(v.interestRate),
          apr: numberOrNull(v.apr),
          due: blank(v.due),
          occurrence: blank(v.occurrence),
          status: blank(v.status),
          since: blank(v.since),
          website: blank(v.website),
          notes: blank(v.notes),
          paymentMethod: blank(v.paymentMethod),
          accountNumber: blank(v.accountNumber),
          associatedAddress: blank(v.associatedAddress),
          serviceKey: blank(v.serviceKey),
        })
      }
      onCancel={onCancel}
    >
      {(form) => (
        <>
          {fields(form, [
            ["service", "Service name", true],
            ["type", "Type"],
            ["expenseGroup", "Expense group"],
            ["monthlyAmount", "Monthly amount"],
            ["interestRate", "Interest rate"],
            ["apr", "APR"],
            ["due", "Due date"],
            ["occurrence", "Occurrence"],
            ["status", "Status"],
            ["since", "Since"],
            ["website", "Website"],
            ["paymentMethod", "Payment method"],
            ["accountNumber", "Account number"],
            ["associatedAddress", "Associated address"],
            ["serviceKey", "Service key"],
            ["notes", "Notes"],
          ])}
        </>
      )}
    </FormShell>
  );
}

export function TransactionCreateForm({
  onCreate,
  onCancel,
}: {
  onCreate: (payload: TransactionCreate) => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <FormShell
      title="Create transaction"
      schema={transactionSchema}
      defaultValues={{
        id: "",
        receiptID: "",
        item: "",
        firstReceiptItem: "false",
        categoryID: "",
        subcategoryID: "",
        merchantCode: "",
        transactionDate: "",
        quantity: "1",
        regularPrice: "",
        paidPrice: "",
        total: "",
        discount: "",
        notes: "",
      }}
      onCreate={async (v) =>
        onCreate({
          id: v.id.trim(),
          receiptID: blank(v.receiptID),
          item: v.item,
          firstReceiptItem: v.firstReceiptItem === "true",
          categoryID: Number(v.categoryID),
          subcategoryID: numberOrNull(v.subcategoryID),
          merchantCode: blank(v.merchantCode),
          transactionDate: blank(v.transactionDate),
          quantity: Number(v.quantity),
          regularPrice: numberOrNull(v.regularPrice),
          paidPrice: numberOrNull(v.paidPrice),
          total: numberOrNull(v.total),
          discount: numberOrNull(v.discount),
          notes: blank(v.notes),
        })
      }
      onCancel={onCancel}
    >
      {(form) => <TransactionFields form={form} />}
    </FormShell>
  );
}

function TransactionFields({ form }: { form: UseFormReturn<TransactionCreateFormValues> }) {
  const selectedCategory = form.watch("categoryID");
  const categoryID = /^\d+$/.test(selectedCategory) ? Number(selectedCategory) : null;
  const categories = useExpenseCategoriesQuery(true);
  const subcategories = useExpenseSubcategoriesQuery(categoryID, categoryID !== null);
  const fieldDefinitions = createTransactionFieldDefinitions({
    categories: (categories.data ?? []).map((item) => ({ value: String(item.id), label: item.name })),
    subcategories: (subcategories.data ?? []).map((item) => ({ value: String(item.id), label: item.name })),
  });
  useEffect(() => {
    form.setValue("subcategoryID", "");
  }, [categoryID, form]);
  return (
    <>{fieldDefinitions.map((field) => renderTransactionField(form, field))}</>
  );
}

function blank(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}
function numberOrNull(value: string): number | null {
  return value.trim() ? Number(value) : null;
}
