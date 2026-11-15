import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tamaguiConfig } from "@gemsforge/ui";
import { APIError } from "../../api";
import { TableDropDialog } from "./TableDropDialog";

const { previewMutation, dropMutation, navigate } = vi.hoisted(() => ({
  previewMutation: { isPending: false, mutateAsync: vi.fn() },
  dropMutation: { isPending: false, mutateAsync: vi.fn() },
  navigate: vi.fn(),
}));

vi.mock("../../data/workflowQueries", () => ({
  usePreviewTableDropMutation: () => previewMutation,
  useDropTableMutation: () => dropMutation,
}));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

const preview = {
  tableName: "GardenNotes",
  rowCount: 2,
  totalDatabaseRowCount: 2,
  metadata: {
    tableViews: 0,
    viewColumnConfigurations: 0,
    viewQueryConfigurations: 0,
    tablePropertyDefinitions: 0,
    tableColumnDefinitions: 0,
    recordPresentations: 0,
    recordBodies: 0,
    trashEntries: 0,
    attachmentReferences: 0,
  },
  filesThatWouldBecomeUnreferenced: [],
  blockingReferences: [],
  warnings: ["Preview only; the live database is unchanged."],
  confirmationToken: "preview-token",
  expiresAt: "2026-11-15T12:00:00Z",
  status: "preview",
};

function renderDialog(onSuccess = vi.fn()) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <MemoryRouter>
        <TableDropDialog tableName="GardenNotes" onClose={vi.fn()} onSuccess={onSuccess} />
      </MemoryRouter>
    </TamaguiProvider>,
  );
}

describe("TableDropDialog", () => {
  beforeEach(() => {
    previewMutation.mutateAsync.mockReset().mockResolvedValue(preview);
    dropMutation.mutateAsync.mockReset().mockResolvedValue({ backupFileName: "GemLife-backup.sqlite" });
    navigate.mockReset();
  });

  it("requires the exact table name before confirming", async () => {
    const onSuccess = vi.fn();
    renderDialog(onSuccess);
    await screen.findByText(/rows in this Hub/);
    const confirm = screen.getByRole("button", { name: "Create backup and delete table" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Type GardenNotes to confirm/), { target: { value: "GardenNotes" } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(dropMutation.mutateAsync).toHaveBeenCalledWith({
        confirmationToken: "preview-token",
        typedTableName: "GardenNotes",
      }),
    );
    expect(onSuccess).toHaveBeenCalledWith("GardenNotes was deleted. Backup preserved as GemLife-backup.sqlite.");
    expect(navigate).toHaveBeenCalledWith("/", {
      state: { successMessage: "GardenNotes was deleted. Backup preserved as GemLife-backup.sqlite." },
    });
  });

  it("keeps deletion disabled when the preview reports blockers", async () => {
    previewMutation.mutateAsync.mockResolvedValueOnce({
      ...preview,
      blockingReferences: [
        {
          kind: "foreign-key",
          table: "Other",
          hubID: null,
          name: "TargetID",
          reason: "Other.TargetID refers to GardenNotes.",
        },
      ],
    });
    renderDialog();
    expect(await screen.findByText("Deletion is blocked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create backup and delete table" })).toBeDisabled();
    expect(screen.queryByLabelText(/Type GardenNotes to confirm/)).not.toBeInTheDocument();
  });

  it("replaces a stale preview when confirmation returns 409", async () => {
    const refreshed = { ...preview, rowCount: 3, totalDatabaseRowCount: 3, confirmationToken: "fresh-token" };
    dropMutation.mutateAsync.mockRejectedValueOnce(new APIError("preview changed", 409, refreshed));
    renderDialog();
    await screen.findByText(/rows in this Hub/);
    fireEvent.change(screen.getByLabelText(/Type GardenNotes to confirm/), { target: { value: "GardenNotes" } });
    fireEvent.click(screen.getByRole("button", { name: "Create backup and delete table" }));
    expect(await screen.findByText(/table changed since this preview/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) => element?.tagName === "P" && Boolean(element.textContent?.includes("3 rows in this Hub")),
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Type GardenNotes to confirm/)).toHaveValue("");
  });
});
