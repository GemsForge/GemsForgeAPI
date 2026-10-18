import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, type ReactNode } from "react";
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Path,
  type Resolver,
  type UseFormReturn,
} from "react-hook-form";
import { z } from "zod";
import { CreateFormFrame, CreateSelectField, CreateTextField } from "../../components/forms/CreateForm";
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

const required = (label: string) => z.string().trim().min(1, `${label} is required.`);
const optional = z.string();
const optionalNumber = z
  .string()
  .refine(
    (value) => value === "" || (/^\d+(\.\d+)?$/.test(value) && Number(value) >= 0),
    "Enter a non-negative number.",
  );
const addressSchema = z.object({
  id: required("Address ID"),
  addressType: required("Address type"),
  addressLine1: optional,
  addressLine2: optional,
  city: optional,
  state: optional,
  postalCode: optional,
  country: required("Country"),
  startDate: optional,
  endDate: optional,
  addressStatus: required("Status"),
  notes: optional,
});
const educationSchema = z.object({
  id: required("Education ID"),
  educationType: required("Education type"),
  institutionName: required("Institution name"),
  program: optional,
  fieldOfStudy: optional,
  credential: optional,
  credentialID: optional,
  startDate: optional,
  endDate: optional,
  awardedDate: optional,
  status: required("Status"),
  locationAddressID: optional,
  website: optional,
  notes: optional,
});
const employmentSchema = z.object({
  id: required("Employment ID"),
  employerName: required("Employer name"),
  employerType: required("Employer type"),
  industry: optional,
  website: optional,
  positionTitle: required("Position title"),
  employmentType: required("Employment type"),
  startDate: optional,
  endDate: optional,
  employmentStatus: required("Status"),
  workAddressID: optional,
  employerContact: optional,
  employerContactNumber: optional,
  employerContactEmail: optional,
  notes: optional,
});
const transactionSchema = z.object({
  id: required("Transaction ID"),
  receiptID: optional,
  item: required("Item"),
  firstReceiptItem: optional,
  categoryID: required("Category ID")
    .regex(/^\d+$/, "Select a category.")
    .refine((value) => Number(value) > 0, "Select a category."),
  subcategoryID: optional,
  merchantCode: optional,
  transactionDate: optional,
  quantity: required("Quantity")
    .regex(/^\d+(\.\d+)?$/, "Enter a positive number.")
    .refine((value) => Number(value) > 0, "Quantity must be greater than zero."),
  regularPrice: optionalNumber,
  paidPrice: optionalNumber,
  total: optionalNumber,
  discount: optionalNumber,
  notes: optional,
});
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
}: {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
  required?: boolean;
  type?: string;
  multiline?: boolean;
}) {
  const message = form.formState.errors[name]?.message;
  return (
    <CreateTextField
      label={label}
      registration={form.register(name)}
      required={isRequired}
      type={type}
      multiline={multiline}
      error={typeof message === "string" ? message : undefined}
    />
  );
}
function Select<T extends FieldValues>({
  form,
  name,
  label,
  options,
}: {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
  options: Array<{ value: string; label: string }>;
}) {
  const message = form.formState.errors[name]?.message;
  return (
    <CreateSelectField
      label={label}
      registration={form.register(name)}
      options={options}
      error={typeof message === "string" ? message : undefined}
    />
  );
}
function fields<T extends FieldValues>(form: UseFormReturn<T>, definitions: Array<[Path<T>, string, boolean?]>) {
  return definitions.map(([name, label, requiredField]) => (
    <Text key={name} form={form} name={name} label={label} required={requiredField} />
  ));
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
}: {
  onCreate: (payload: AddressCreate) => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <FormShell
      title="Create address"
      schema={addressSchema}
      defaultValues={{
        id: "",
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
          id: v.id.trim(),
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
      {(form) => (
        <>
          {fields(form, [
            ["id", "Stable address ID", true],
            ["addressType", "Address type", true],
            ["addressLine1", "Address line 1"],
            ["addressLine2", "Address line 2"],
            ["city", "City"],
            ["state", "State / region"],
            ["postalCode", "Postal code"],
            ["country", "Country", true],
            ["startDate", "Start date"],
            ["endDate", "End date"],
            ["addressStatus", "Status", true],
            ["notes", "Notes"],
          ])}
        </>
      )}
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
          {fields(form, [
            ["id", "Stable education ID", true],
            ["educationType", "Education type", true],
            ["institutionName", "Institution name", true],
            ["program", "Program"],
            ["fieldOfStudy", "Field of study"],
            ["credential", "Credential"],
            ["credentialID", "Credential ID"],
            ["startDate", "Start date"],
            ["endDate", "End date"],
            ["awardedDate", "Awarded date"],
            ["status", "Status", true],
            ["website", "Website"],
            ["notes", "Notes"],
          ])}
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

export function EmploymentCreateForm({
  addresses,
  onCreate,
  onCancel,
}: {
  addresses: Address[];
  onCreate: (payload: EmploymentCreate) => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <FormShell
      title="Create employment record"
      schema={employmentSchema}
      defaultValues={{
        id: "",
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
          {fields(form, [
            ["id", "Stable employment ID", true],
            ["employerName", "Employer name", true],
            ["employerType", "Employer type", true],
            ["industry", "Industry"],
            ["website", "Website"],
            ["positionTitle", "Position title", true],
            ["employmentType", "Employment type", true],
            ["startDate", "Start date"],
            ["endDate", "End date"],
            ["employmentStatus", "Status", true],
            ["employerContact", "Contact"],
            ["employerContactNumber", "Contact number"],
            ["employerContactEmail", "Contact email"],
            ["notes", "Notes"],
          ])}
          <Select
            form={form}
            name="workAddressID"
            label="Work address"
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

type TransactionFormValues = z.infer<typeof transactionSchema>;
function TransactionFields({ form }: { form: UseFormReturn<TransactionFormValues> }) {
  const selectedCategory = form.watch("categoryID");
  const categoryID = /^\d+$/.test(selectedCategory) ? Number(selectedCategory) : null;
  const categories = useExpenseCategoriesQuery(true);
  const subcategories = useExpenseSubcategoriesQuery(categoryID, categoryID !== null);
  useEffect(() => {
    form.setValue("subcategoryID", "");
  }, [categoryID, form]);
  return (
    <>
      {fields(form, [
        ["id", "Stable transaction ID", true],
        ["receiptID", "Receipt ID"],
        ["item", "Item", true],
        ["merchantCode", "Merchant code"],
        ["transactionDate", "Transaction date"],
        ["quantity", "Quantity", true],
        ["regularPrice", "Regular price"],
        ["paidPrice", "Paid price"],
        ["total", "Total"],
        ["discount", "Discount"],
        ["notes", "Notes"],
      ])}
      <Select
        form={form}
        name="categoryID"
        label="Category"
        options={(categories.data ?? []).map((item) => ({ value: String(item.id), label: item.name }))}
      />
      <Select
        form={form}
        name="subcategoryID"
        label="Subcategory"
        options={(subcategories.data ?? []).map((item) => ({ value: String(item.id), label: item.name }))}
      />
      <Select
        form={form}
        name="firstReceiptItem"
        label="First item on receipt"
        options={[
          { value: "false", label: "No" },
          { value: "true", label: "Yes" },
        ]}
      />
    </>
  );
}

function blank(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}
function numberOrNull(value: string): number | null {
  return value.trim() ? Number(value) : null;
}
