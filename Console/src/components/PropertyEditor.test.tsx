import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { APIError } from "../api";
import { PropertyEditor } from "./PropertyEditor";

describe("PropertyEditor", () => {
  it("saves only a changed value and closes after success", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <PropertyEditor
        label="City"
        initialValue="Brooklyn"
        editLabel="Edit city"
        saveLabel="Save city"
        onSave={onSave}
      />,
    );

    const editButton = screen.getByRole("button", { name: "Edit city" });
    expect(editButton).toHaveClass("icon-button");
    expect(editButton).toHaveAttribute("title", "Edit city");
    fireEvent.click(editButton);
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Queens" } });
    fireEvent.click(screen.getByRole("button", { name: "Save city" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith("Queens"));
    expect(screen.queryByLabelText("City")).not.toBeInTheDocument();
  });

  it("cancels a draft without saving", () => {
    const onSave = vi.fn();
    render(
      <PropertyEditor
        label="City"
        initialValue="Brooklyn"
        editLabel="Edit city"
        saveLabel="Save city"
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit city" }));
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Queens" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("City")).not.toBeInTheDocument();
  });

  it("retains a failed draft and presents safe API error copy", async () => {
    const onSave = vi.fn().mockRejectedValue(new APIError("internal SQL details", 422));
    render(
      <PropertyEditor
        label="City"
        initialValue="Brooklyn"
        editLabel="Edit city"
        saveLabel="Save city"
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit city" }));
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Queens" } });
    fireEvent.click(screen.getByRole("button", { name: "Save city" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Some information is invalid");
    expect(screen.getByLabelText("City")).toHaveValue("Queens");
    expect(screen.getByLabelText("City")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).not.toHaveTextContent("internal SQL details");
  });
});
