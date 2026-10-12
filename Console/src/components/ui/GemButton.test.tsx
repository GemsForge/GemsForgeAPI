import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { describe, expect, it } from "vitest";
import { GemButton } from "./GemButton";
import { tamaguiConfig } from "../../design-system";

describe("GemButton", () => {
  it("renders an accessible action button", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <GemButton>Save record</GemButton>
      </TamaguiProvider>,
    );

    expect(screen.getByRole("button", { name: "Save record" })).toBeInTheDocument();
  });
});
