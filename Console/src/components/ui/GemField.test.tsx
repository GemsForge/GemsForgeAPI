import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { describe, expect, it } from "vitest";
import { GemField } from "./GemField";
import { tamaguiConfig } from "../../design-system";

describe("GemField", () => {
  it("associates its label with the input", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <GemField id="table-name" label="Table name" />
      </TamaguiProvider>,
    );

    expect(screen.getByLabelText("Table name")).toHaveAttribute("id", "table-name");
  });
});
