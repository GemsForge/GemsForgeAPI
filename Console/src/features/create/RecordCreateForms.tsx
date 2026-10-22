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
  GemHueCreate,
  ServiceAccountCreate,
  TransactionCreate,
} from "../../types";
import {
  addressStatusOptions,
  addressFieldDefinitions,
  addressTypeOptions,
  addressSchema,
} from "../addresses/AddressFieldDefinitions";

const required = (label: string) => z.string().trim().min(1, `${label} is required.`);
const optional = z.string();
/** Keep browser date inputs strict so JavaScript cannot normalize invalid calendar dates. */
function isValidDateInput(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const [, year, month, day] = match;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() + 1 === Number(month) &&
    date.getUTCDate() === Number(day)
  );
}

/** Validate optional Employment contact values without rejecting intentionally blank fields. */
const optionalEmploymentDate = optional.refine(
  (value) => !value.trim() || isValidDateInput(value.trim()),
  "Enter a valid date.",
);
const optionalEmploymentURL = optional.refine((value) => {
  const normalized = value.trim();
  if (!normalized) return true;
  try {
    const url = new URL(normalized);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}, "Enter a valid URL starting with http:// or https://.");
const optionalEmploymentEmail = optional.refine(
  (value) => !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()),
  "Enter a valid email address.",
);
/** Accept international numbers with country codes, common separators, and optional extensions. */
const employmentPhonePattern = /^\+?[0-9().\-\s]+(?:\s*(?:x|ext\.?)\s*[0-9]+)?$/i;
const optionalEmploymentPhone = optional.refine((value) => {
  const normalized = value.trim();
  if (!normalized) return true;
  const digitCount = (normalized.match(/\d/g) ?? []).length;
  return employmentPhonePattern.test(normalized) && digitCount >= 7;
}, "Enter a valid phone number.");
const optionalNumber = z
  .string()
  .refine(
    (value) => value === "" || (/^\d+(\.\d+)?$/.test(value) && Number(value) >= 0),
    "Enter a non-negative number.",
  );
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
const employmentSchema = z
  .object({
    id: required("Employment ID"),
    employerName: required("Employer name"),
    employerType: required("Employer type"),
    industry: optional,
    website: optionalEmploymentURL,
    positionTitle: required("Position title"),
    employmentType: required("Employment type"),
    startDate: optionalEmploymentDate,
    endDate: optionalEmploymentDate,
    employmentStatus: required("Status"),
    workAddressID: optional,
    employerContact: optional,
    employerContactNumber: optionalEmploymentPhone,
    employerContactEmail: optionalEmploymentEmail,
    notes: optional,
  })
  .superRefine((values, context) => {
    if (values.startDate && values.endDate && values.endDate < values.startDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be on or after start date.",
      });
    }
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
  serviceKey: optional.refine(
    (value) => !value.trim() || /^[A-Z0-9_]+$/.test(value.trim()),
    "Use uppercase letters, numbers, and underscores only.",
  ),
});
const gemHueSchema = z.object({
  id: required("Hue ID"),
  colorName: required("Color name"),
  colorFamily: optional,
  hexCode: required("Hex code"),
  mood: optional,
  palette: optional,
  description: optional,
  createdDate: optional,
  notes: optional,
});

/** Keep service classifications consistent between create and edit workflows. */
const serviceTypeOptions = [
  { value: "Subscription", label: "Subscription" },
  { value: "Utility", label: "Utility" },
  { value: "Health", label: "Health" },
  { value: "Credit", label: "Credit" },
  { value: "Loan", label: "Loan" },
  { value: "Insurance", label: "Insurance" },
  { value: "Membership", label: "Membership" },
  { value: "Other", label: "Other" },
];

/** Keep expense groups aligned with the existing service record editor. */
const serviceExpenseGroupOptions = [
  { value: "Fixed Bills (Obligations)", label: "Fixed Bills (Obligations)" },
  { value: "Variable Bills", label: "Variable Bills" },
  { value: "Home", label: "Home" },
  { value: "Lifestyle", label: "Lifestyle" },
  { value: "Other", label: "Other" },
];

/** Keep service status choices consistent across record creation and editing. */
const serviceStatusOptions = [
  { value: "Active", label: "Active" },
  { value: "Closed", label: "Closed" },
  { value: "Paused", label: "Paused" },
  { value: "Other", label: "Other" },
];
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
              <Select
                form={form}
                name="addressType"
                label={addressFieldDefinitions.addressType.label}
                options={addressTypeOptions}
                required
              />
              <Text
                form={form}
                name="addressLine1"
                label={addressFieldDefinitions.addressLine1.label}
                width={addressFieldDefinitions.addressLine1.width}
                placeholder={addressFieldDefinitions.addressLine1.placeholder}
              />
              <Text
                form={form}
                name="addressLine2"
                label={addressFieldDefinitions.addressLine2.label}
                width={addressFieldDefinitions.addressLine2.width}
                placeholder={addressFieldDefinitions.addressLine2.placeholder}
              />
              <Text
                form={form}
                name="country"
                label={addressFieldDefinitions.country.label}
                required
                width={addressFieldDefinitions.country.width}
                placeholder={addressFieldDefinitions.country.placeholder}
              />
            </div>
            <div className="create-form-grid create-form-grid--address-location">
              <Text
                form={form}
                name="city"
                label={addressFieldDefinitions.city.label}
                width={addressFieldDefinitions.city.width}
                placeholder={addressFieldDefinitions.city.placeholder}
              />
              <Text
                form={form}
                name="state"
                label={addressFieldDefinitions.state.label}
                width={addressFieldDefinitions.state.width}
                placeholder={addressFieldDefinitions.state.placeholder}
              />
              <Text
                form={form}
                name="postalCode"
                label={addressFieldDefinitions.postalCode.label}
                width={addressFieldDefinitions.postalCode.width}
                placeholder={addressFieldDefinitions.postalCode.placeholder}
              />
            </div>
            <div className="create-form-grid create-form-grid--compact">
              <Text
                form={form}
                name="startDate"
                label={addressFieldDefinitions.startDate.label}
                type="date"
                width={addressFieldDefinitions.startDate.width}
                placeholder={addressFieldDefinitions.startDate.placeholder}
              />
              <Text
                form={form}
                name="endDate"
                label={addressFieldDefinitions.endDate.label}
                type="date"
                width={addressFieldDefinitions.endDate.width}
                placeholder={addressFieldDefinitions.endDate.placeholder}
              />
              <Select
                form={form}
                name="addressStatus"
                label={addressFieldDefinitions.addressStatus.label}
                options={addressStatusOptions}
                required
              />
            </div>
            <Text
              form={form}
              name="notes"
              label={addressFieldDefinitions.notes.label}
              multiline
              width={addressFieldDefinitions.notes.width}
              placeholder={addressFieldDefinitions.notes.placeholder}
            />
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

  return (
    <FormShell
      title="Create employment record"
      schema={employmentSchema}
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
            {fields(form, [["employerName", "Employer name", true]])}
            <Select form={form} name="employerType" label="Employer type" options={employerTypeOptions} required />
          </div>
          <div className="create-form-grid">
            <Select form={form} name="industry" label="Industry" options={industryOptions} />
            <Text form={form} name="website" label="Website" type="url" width="medium" />
          </div>
          <div className="create-form-grid">
            {fields(form, [["positionTitle", "Position title", true]])}
            <Select
              form={form}
              name="employmentType"
              label="Employment type"
              options={employmentTypeOptions}
              required
            />
          </div>
          <div className="create-form-grid create-form-grid--compact">
            <Text form={form} name="startDate" label="Start date" type="date" width="short" />
            <Text form={form} name="endDate" label="End date" type="date" width="short" />
            <Select form={form} name="employmentStatus" label="Status" options={statusOptions} required />
          </div>
          <div className="create-form-grid create-form-grid--contact">
            <Text form={form} name="employerContact" label="Contact" />
            <Text form={form} name="employerContactNumber" label="Contact number" type="tel" width="short" />
            <Text form={form} name="employerContactEmail" label="Contact email" type="email" width="medium" />
          </div>
          <Text form={form} name="notes" label="Notes" multiline />
          <Select
            form={form}
            name="workAddressID"
            label="Work address"
            searchable
            searchPlaceholder="Search existing addresses"
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

/** Render the shared Gem Hue creation form used by input and utility workflows. */
export function GemHueCreateForm({
  onCreate,
  onCancel,
}: {
  onCreate: (payload: GemHueCreate) => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <FormShell
      title="Create Gem Hue record"
      schema={gemHueSchema}
      defaultValues={{
        id: "",
        colorName: "",
        colorFamily: "",
        hexCode: "",
        mood: "",
        palette: "",
        description: "",
        createdDate: "",
        notes: "",
      }}
      onCreate={async (values) =>
        onCreate({
          ...values,
          id: values.id.trim(),
          colorFamily: blank(values.colorFamily),
          mood: blank(values.mood),
          palette: blank(values.palette),
          description: blank(values.description),
          createdDate: blank(values.createdDate),
          notes: blank(values.notes),
        })
      }
      onCancel={onCancel}
    >
      {(form) => (
        <>
          <div className="create-form-grid">
            <Text form={form} name="id" label="Hue ID" required width="medium" />
            <Text form={form} name="colorName" label="Color name" required width="medium" />
            <Text form={form} name="hexCode" label="Hex code" required width="short" />
            <Text form={form} name="createdDate" label="Created date" type="date" width="short" />
            <Text form={form} name="colorFamily" label="Color family" width="short" />
            <Text form={form} name="mood" label="Mood" width="short" />
            <Text form={form} name="palette" label="Palette" width="short" />
          </div>
          <Text form={form} name="description" label="Description" multiline />
          <Text form={form} name="notes" label="Notes" multiline />
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
          <div className="create-form-grid">
            <Text form={form} name="service" label="Service name" required width="medium" />
            <Select form={form} name="type" label="Type" options={serviceTypeOptions} />
            <Select form={form} name="expenseGroup" label="Expense group" options={serviceExpenseGroupOptions} />
            <Text form={form} name="monthlyAmount" label="Monthly amount" type="number" width="medium" />
            <Text form={form} name="apr" label="APR" type="number" width="short" />
            <Text form={form} name="due" label="Due date" type="date" width="short" />
            <Text form={form} name="since" label="Since" type="date" width="short" />
            <Select form={form} name="status" label="Status" options={serviceStatusOptions} />
            <Text form={form} name="serviceKey" label="Service key" width="medium" />
            <Text form={form} name="website" label="Website" type="url" width="medium" />
            <Text form={form} name="interestRate" label="Interest rate" type="number" width="short" />
            <Text form={form} name="occurrence" label="Occurrence" width="short" />
            <Text form={form} name="paymentMethod" label="Payment method" />
            <Text form={form} name="accountNumber" label="Account number" />
            <Text form={form} name="associatedAddress" label="Associated address" />
          </div>
          <Text form={form} name="notes" label="Notes" multiline width="long" />
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
