import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TamaguiProvider } from "tamagui";
import { tamaguiConfig } from "@gemsforge/ui";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import { createSchemaRecordOptions } from "./SchemaRecordActions";

afterEach(() => vi.restoreAllMocks());

describe("schema record actions", () => {
  it("creates one record from schema fields while omitting server-managed IDs", async () => {
    const table = {
      name: "FamilyGoals",
      columns: [
        { name: "ID", dataType: "TEXT", nullable: false, primaryKey: true, defaultValue: null },
        { name: "HubID", dataType: "TEXT", nullable: false, primaryKey: false, defaultValue: null },
        { name: "Title", dataType: "TEXT", nullable: false, primaryKey: false, defaultValue: null },
        { name: "Quantity", dataType: "INTEGER", nullable: false, primaryKey: false, defaultValue: null },
      ],
    };
    const create = vi.spyOn(api, "createSchemaPageRecord").mockResolvedValue({
      table: "FamilyGoals",
      recordID: "generated-id",
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const option = createSchemaRecordOptions(table)[0]!;
    render(
      <QueryClientProvider client={client}>
        <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
          {option.render({ close: vi.fn() })}
        </TamaguiProvider>
      </QueryClientProvider>,
    );

    expect(screen.queryByLabelText("ID")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("HubID")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Family trip" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Quantity" }), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith("FamilyGoals", { Title: "Family trip", Quantity: "3" }));
  });
});
