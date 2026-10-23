import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { describe, expect, it } from "vitest";
import { tamaguiConfig } from "../../design-system";
import { GDate } from "./GDate";

describe("GDate", () => {
  it("renders a native calendar picker with a normalized date value", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <GDate label="Start date" value="01/15/2026" format="MM/DD/YYYY" />
      </TamaguiProvider>,
    );

    const picker = screen.getByLabelText("Start date");
    expect(picker).toHaveAttribute("type", "date");
    expect(picker).toHaveValue("2026-01-15");
  });
});
