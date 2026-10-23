import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { describe, expect, it } from "vitest";
import { tamaguiConfig } from "../../design-system";
import { GDateField } from "./GDateField";

describe("GDateField", () => {
  it("renders a calendar picker with the formatted selected date", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <GDateField label="Start date" value="01/15/2026" format="MM/DD/YYYY" />
      </TamaguiProvider>,
    );

    expect(screen.getByLabelText("Start date")).toHaveTextContent("01/15/2026");
  });
});
