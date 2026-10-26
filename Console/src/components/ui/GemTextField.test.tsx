import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { describe, expect, it } from "vitest";
import { GemTextField } from "./GemTextField";
import { tamaguiConfig } from "../../design-system";

describe("GemTextField", () => {
  it("generates unique label associations when an ID is omitted", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <GemTextField label="First field" />
        <GemTextField label="Second field" />
      </TamaguiProvider>,
    );
    const first = screen.getByLabelText("First field");
    const second = screen.getByLabelText("Second field");
    expect(first.id).toBeTruthy();
    expect(first.id).not.toBe(second.id);
  });
  it("associates its label with the input", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <GemTextField id="table-name" label="Table name" />
      </TamaguiProvider>,
    );

    expect(screen.getByLabelText("Table name")).toHaveAttribute("id", "table-name");
  });
});
