import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecordFields } from "./RecordFields";

describe("RecordFields", () => {
  it("renders resource-defined labels, rich values, and layout classes semantically", () => {
    render(
      <RecordFields
        className="address-fields"
        fields={[
          { label: "City", value: "Brooklyn" },
          { label: "Website", value: <a href="https://example.com">Visit</a> },
          { label: "Notes", value: "Keep private", className: "address-notes" },
        ]}
      />,
    );

    expect(screen.getByText("Brooklyn")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Visit" })).toHaveAttribute("href", "https://example.com");
    expect(screen.getByText("Notes").parentElement).toHaveClass("address-notes");
    expect(screen.getByText("City").closest("dl")).toHaveClass("record-fields", "address-fields");
  });
});
