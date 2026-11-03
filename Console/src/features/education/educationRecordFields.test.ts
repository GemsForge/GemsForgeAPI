import { describe, expect, it, vi } from "vitest";
import type { Address, Education } from "../../types";
import { educationFieldDefinitions, educationFieldsWithAddresses, educationSchema } from "./educationCreateFields";
import { educationEditableFields } from "./educationRecordFields";

const address: Address = {
  id: "ADDR-1", addressType: "School", addressLine1: "602 E. Story Road", addressLine2: null,
  city: "Winter Garden", state: "FL", postalCode: "34787", country: "US",
  startDate: null, endDate: null, addressStatus: "Current",
};

const record: Education = {
  id: "EDU-1", educationType: "Elementary School", institutionName: "Maxey Elementary School",
  program: null, fieldOfStudy: null, credential: null, credentialID: null,
  startDate: null, endDate: null, awardedDate: null, status: "Completed",
  locationAddressID: address.id, address, website: null, notes: null,
};

describe("Education property contract", () => {
  it("uses the create definitions for every editable record property", () => {
    const editFields = educationEditableFields(record, [address], vi.fn());
    expect(editFields.slice(0, -1).map((field) => field.label)).toEqual(
      educationFieldDefinitions.filter((field) => field.name !== "id").map((field) => field.label),
    );
    expect(editFields.find((field) => field.label === "Status")).toMatchObject({ primitive: "status", required: true });
    expect(editFields.find((field) => field.label === "Type")?.options).toContainEqual({ value: "Elementary School", label: "Elementary School" });
    expect(editFields.find((field) => field.label === "Program")).toMatchObject({ inputType: "text" });
    expect(editFields.find((field) => field.label === "Website")).toMatchObject({ primitive: "url", inputType: "url" });
  });

  it("preserves the selected Location in create validation and patches the same property in edit", async () => {
    const location = educationFieldsWithAddresses([address]).find((field) => field.name === "locationAddressID");
    expect(location?.options).toEqual([{ value: address.id, label: "602 E. Story Road, Winter Garden, FL, 34787" }]);

    const parsed = educationSchema.parse({
      id: record.id, educationType: record.educationType, institutionName: record.institutionName,
      program: "", fieldOfStudy: "", credential: "", credentialID: "",
      startDate: "", endDate: "", awardedDate: "", status: record.status,
      locationAddressID: address.id, website: "", notes: "",
    });
    expect(parsed.locationAddressID).toBe(address.id);

    const onPatch = vi.fn().mockResolvedValue(undefined);
    const editLocation = educationEditableFields(record, [address], onPatch).find((field) => field.label === "Location");
    await editLocation?.onSave?.("ADDR-2");
    expect(onPatch).toHaveBeenCalledWith({ locationAddressID: "ADDR-2" });
  });
});
