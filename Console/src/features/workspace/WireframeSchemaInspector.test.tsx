import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { tamaguiConfig } from "@gemsforge/ui";
import type { RecordPropertyDefinition } from "../../table-kit";
import { WireframeSchemaInspector } from "./WireframeSchemaInspector";
import { WireframePropertySelectOptionsContext, WireframePropertyTypeContext } from "./WireframePropertyEditor";

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
          onSave: async () => undefined,
        },
      },
    ];

    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <MemoryRouter>
          <WireframePropertyTypeContext.Provider value={{ monthlyAmount: "Select" }}>
            <WireframePropertySelectOptionsContext.Provider value={{ monthlyAmount: ["125", "250"] }}>
              <WireframeSchemaInspector record={record} properties={properties} />
            </WireframePropertySelectOptionsContext.Provider>
          </WireframePropertyTypeContext.Provider>
        </MemoryRouter>
      </TamaguiProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "$125.00" }));
    const select = screen.getByRole("combobox", { name: "Monthly amount" });
    expect(select).toBeInTheDocument();
    fireEvent.click(select);
    expect(screen.getByRole("option", { name: "250" })).toBeInTheDocument();
  });

  it("edits Multi-select values and persists them as semicolon-delimited SQLite text", async () => {
    const record = { id: "REC-1", tags: "low;high" };
    const onSave = vi.fn(async (_value: string) => undefined);
    const properties: RecordPropertyDefinition<typeof record>[] = [
      {
        id: "tags",
        label: "Tags",
        kind: "text",
        getValue: (item) => ({ raw: item.tags, display: item.tags }),
        edit: { inputType: "text", onSave: (_item, value) => onSave(String(value)) },
      },
    ];

    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <MemoryRouter>
          <WireframePropertyTypeContext.Provider value={{ tags: "Multi-select" }}>
            <WireframePropertySelectOptionsContext.Provider value={{ tags: ["low", "medium", "high"] }}>
              <WireframeSchemaInspector record={record} properties={properties} />
            </WireframePropertySelectOptionsContext.Provider>
          </WireframePropertyTypeContext.Provider>
        </MemoryRouter>
      </TamaguiProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "low, high" }));
    expect(screen.getByRole("checkbox", { name: "low" })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "medium" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith("low;high;medium"));
  });
});
