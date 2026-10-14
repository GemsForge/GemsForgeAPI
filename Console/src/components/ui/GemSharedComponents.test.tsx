import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { GemDataTable } from "./GemDataTable";
import { GemEmptyState } from "./GemEmptyState";
import { GemLoadingState } from "./GemLoadingState";
import { GemSectionHeader } from "./GemSectionHeader";
import { GemStatusPill } from "./GemStatusPill";
import { TamaguiProvider } from "tamagui";
import { tamaguiConfig } from "../../design-system";

function renderWithTheme(element: ReactElement) {
  return render(<TamaguiProvider config={tamaguiConfig} defaultTheme="dark">{element}</TamaguiProvider>);
}

describe("shared Gem Life components", () => {
  it("renders a semantic page heading and trailing content", () => {
    renderWithTheme(<GemSectionHeader eyebrow="Life data" title="Education" description="Records" trailing={<GemStatusPill>2 records</GemStatusPill>} />);
    expect(screen.getByRole("heading", { name: "Education" })).toBeInTheDocument();
    expect(screen.getByText("2 records")).toBeInTheDocument();
  });

  it("renders empty and loading states with accessible status", () => {
    renderWithTheme(<><GemEmptyState title="No records" description="Nothing is available." /><GemLoadingState label="Reading records…" /></>);
    expect(screen.getByRole("heading", { name: "No records" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Reading records…");
  });

  it("renders an accessible data table from typed columns", () => {
    renderWithTheme(<GemDataTable caption="Education records" rows={[{ id: "EDU-1", name: "Example" }]} rowKey={(row) => row.id} columns={[{ key: "name", label: "Name", render: (row) => row.name }]} />);
    expect(screen.getByRole("table", { name: "Education records" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Example" })).toBeInTheDocument();
  });
});
