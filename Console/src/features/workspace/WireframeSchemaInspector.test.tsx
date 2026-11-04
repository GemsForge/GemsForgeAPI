import { fireEvent, render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { describe, expect, it } from "vitest";
import { tamaguiConfig } from "@gemsforge/ui";
import type { RecordPropertyDefinition } from "../../table-kit";
import { WireframeSchemaInspector } from "./WireframeSchemaInspector";

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
});
