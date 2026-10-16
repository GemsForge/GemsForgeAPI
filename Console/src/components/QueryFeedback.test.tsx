import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { APIError } from "../api";
import { QueryFeedback } from "./QueryFeedback";

describe("QueryFeedback", () => {
  it("shows loading state without a retry action", () => {
    render(<QueryFeedback query={{ isLoading: true, error: null, refetch: vi.fn() }} />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading records");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("shows safe retryable error copy and retries on request", () => {
    const refetch = vi.fn();
    render(<QueryFeedback query={{ isLoading: false, error: new APIError("raw detail", 503), refetch }} />);

    expect(screen.getByRole("alert")).toHaveTextContent("local API encountered a problem");
    expect(screen.getByRole("alert")).not.toHaveTextContent("raw detail");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("does not offer retry when the error is not retryable", () => {
    render(
      <QueryFeedback query={{ isLoading: false, error: new APIError("private detail", 404), refetch: vi.fn() }} />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("could not be found");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });
});
