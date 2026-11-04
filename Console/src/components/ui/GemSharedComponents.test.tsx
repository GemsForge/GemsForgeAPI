import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { GemDataTable } from "./GemDataTable--LEGACY";
import {
  GemBody,
  GemButton,
  GemCard,
  GemCaption,
  GemEmptyState,
  GemLoadingState,
  GemPageTitle,
  GemRecordTitle,
  GemSectionHeader,
  GemSectionHeading,
  GemStatusPill,
  tamaguiConfig,
} from "@gemsforge/ui";
import { TamaguiProvider } from "tamagui";

function renderWithTheme(element: ReactElement) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
      {element}
    </TamaguiProvider>,
  );
}

describe("shared Gem Life components", () => {
  it("renders a semantic page heading and trailing content", () => {
    renderWithTheme(
      <GemSectionHeader
        eyebrow="Life data"
        title="Education"
        description="Records"
        trailing={<GemStatusPill>2 records</GemStatusPill>}
      />,
    );
    expect(screen.getByRole("heading", { name: "Education" })).toBeInTheDocument();
    expect(screen.getByText("2 records")).toBeInTheDocument();
  });

  it("renders typography roles with their semantic heading levels", () => {
    renderWithTheme(
      <>
        <GemPageTitle>Workspace</GemPageTitle>
        <GemSectionHeading>Records</GemSectionHeading>
        <GemRecordTitle>Education record</GemRecordTitle>
        <GemBody>Supporting details</GemBody>
        <GemCaption>Updated today</GemCaption>
      </>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Workspace" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Records" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Education record" })).toBeInTheDocument();
    expect(screen.getByText("Supporting details").tagName).toBe("P");
    expect(screen.getByText("Updated today")).toBeInTheDocument();
  });

  it("composes cards and exposes each semantic status tone", () => {
    renderWithTheme(
      <>
        <GemCard>Workspace summary</GemCard>
        <GemStatusPill tone="success">Saved</GemStatusPill>
        <GemStatusPill tone="warning">Needs review</GemStatusPill>
        <GemStatusPill tone="danger">Failed</GemStatusPill>
        <GemButton>Continue</GemButton>
      </>,
    );

    expect(screen.getByText("Workspace summary")).toBeInTheDocument();
    expect(screen.getByText("Saved")).toHaveClass("status-success");
    expect(screen.getByText("Needs review")).toHaveClass("status-warning");
    expect(screen.getByText("Failed")).toHaveClass("status-danger");
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("renders empty and loading states with accessible status", () => {
    renderWithTheme(
      <>
        <GemEmptyState title="No records" description="Nothing is available." />
        <GemLoadingState label="Reading records…" />
      </>,
    );
    expect(screen.getByRole("heading", { name: "No records" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Reading records…");
  });

  it("renders an accessible data table from typed columns", () => {
    renderWithTheme(
      <GemDataTable
        caption="Education records"
        rows={[{ id: "EDU-1", name: "Example" }]}
        rowKey={(row) => row.id}
        columns={[{ key: "name", label: "Name", render: (row) => row.name }]}
      />,
    );
    expect(screen.getByRole("table", { name: "Education records" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Example" })).toBeInTheDocument();
  });
});
