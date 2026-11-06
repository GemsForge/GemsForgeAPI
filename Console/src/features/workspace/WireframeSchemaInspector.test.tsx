import { fireEvent, render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { tamaguiConfig } from "@gemsforge/ui";
import type { RecordPropertyDefinition } from "../../table-kit";
import { WireframeSchemaInspector } from "./WireframeSchemaInspector";
import { WireframePropertyTypeContext } from "./WireframePropertyEditor";

type Record = { id: string; monthlyAmount: number };

describe("WireframeSchemaInspector property metadata", () => {
  it("passes the inferred type and icon into the property editor", () => {
    const record: Record = { id: "EXP-1", monthlyAmount: 125 };
    const properties: RecordPropertyDefinition<Record>[] = [
      {
        id: "monthlyAmount",
        label: "Monthly amount",
        kind: "number",
        getValue: (item) => ({ raw: item.monthlyAmount, display: "$125.00" }),
      },
    ];

    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <WireframeSchemaInspector record={record} properties={properties} />
      </TamaguiProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Monthly amount property" }));

    expect(screen.getByRole("combobox", { name: "Primitive type" })).toHaveTextContent("Currency");
    expect(screen.getByRole("radio", { name: "Currency" })).toHaveAttribute("aria-checked", "true");
  });

  it("uses a saved Select type to render a select editor for an existing number property", () => {
    const record: Record = { id: "EXP-1", monthlyAmount: 125 };
    const properties: RecordPropertyDefinition<Record>[] = [
      {
        id: "monthlyAmount",
        label: "Monthly amount",
        kind: "number",
        getValue: (item) => ({ raw: item.monthlyAmount, display: "$125.00" }),
        edit: {
          inputType: "number",
          options: [
            { value: "125", label: "$125.00" },
            { value: "250", label: "$250.00" },
          ],
          onSave: async () => undefined,
        },
      },
    ];

    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <MemoryRouter>
          <WireframePropertyTypeContext.Provider value={{ monthlyAmount: "Select" }}>
            <WireframeSchemaInspector record={record} properties={properties} />
          </WireframePropertyTypeContext.Provider>
        </MemoryRouter>
      </TamaguiProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "$125.00" }));
    expect(screen.getByRole("combobox", { name: "Monthly amount" })).toBeInTheDocument();
  });
});
