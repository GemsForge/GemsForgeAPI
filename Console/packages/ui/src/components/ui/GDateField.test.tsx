import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
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

  it("keeps its trigger and portaled calendar on the light workspace surface", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <GDateField label="Start date" value="2026-01-15" wireframe />
      </TamaguiProvider>,
    );

    const trigger = screen.getByLabelText("Start date");
    expect(trigger).toHaveAttribute("data-wireframe-field", "true");
    fireEvent.click(trigger);
    expect(document.querySelector('.gem-date-popover[data-wireframe-date="true"]')).toBeInTheDocument();
  });

  it("accepts a typed date, jumps to its month, and saves it", () => {
    const onChange = vi.fn();
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <GDateField label="Start date" value="2026-01-15" onChange={onChange} />
      </TamaguiProvider>,
    );

    fireEvent.click(screen.getByLabelText("Start date"));
    const dateInput = screen.getByLabelText("Start date date");
    fireEvent.change(dateInput, { target: { value: "5/21/1990" } });

    expect(onChange).toHaveBeenCalledWith("1990-05-21");
    expect(screen.getByText("May 1990")).toBeInTheDocument();
    expect(dateInput).toHaveValue("5/21/1990");
  });
});
