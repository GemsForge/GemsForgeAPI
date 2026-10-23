import { describe, expect, it } from "vitest";
import { addressFieldDefinitions, addressSchema } from "../addresses/addressCreateFields";
import { educationFieldDefinitions, educationSchema } from "../education/educationCreateFields";
import { createEmploymentFieldDefinitions, createEmploymentSchema } from "../employment/employmentCreateFields";
import { createTransactionFieldDefinitions, createTransactionSchema } from "../transactions/transactionCreateFields";
import { domainFieldDefinitions, domainSchema } from "../domains/domainCreateFields";
import { serviceAccountFieldDefinitions, serviceAccountSchema } from "../service-accounts/serviceAccountCreateFields";

const emptyOptions = { categories: [], subcategories: [] };
const employmentOptions = { employerType: [], industry: [], employmentType: [], status: [], workAddress: [] };

describe("feature form field contracts", () => {
  it("keep field names unique", () => {
    const contracts = [
      addressFieldDefinitions,
      educationFieldDefinitions,
      createEmploymentFieldDefinitions(employmentOptions),
      createTransactionFieldDefinitions(emptyOptions),
      serviceAccountFieldDefinitions,
      domainFieldDefinitions,
    ];

    for (const fields of contracts) {
      const names = fields.map((field) => field.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("keeps required validation attached to the rendered contract", () => {
    expect(addressSchema.safeParse({ addressType: "", country: "", addressStatus: "" }).success).toBe(false);
    expect(educationSchema.safeParse({ id: "", educationType: "", institutionName: "", status: "" }).success).toBe(
      false,
    );
    expect(
      createEmploymentSchema(createEmploymentFieldDefinitions(employmentOptions)).safeParse({
        employerName: "",
        employerType: "",
        positionTitle: "",
        employmentType: "",
        employmentStatus: "",
      }).success,
    ).toBe(false);
    expect(
      createTransactionSchema(createTransactionFieldDefinitions(emptyOptions)).safeParse({
        id: "",
        item: "",
        categoryID: "",
        quantity: "",
      }).success,
    ).toBe(false);
    expect(serviceAccountSchema.safeParse({ service: "" }).success).toBe(false);
    expect(domainSchema.safeParse({ title: "", description: "" }).success).toBe(false);
  });
});
