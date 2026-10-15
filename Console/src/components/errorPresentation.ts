import { APIError } from "../api";

export type UserFacingError = {
  message: string;
  canRetry: boolean;
};

/** Converts transport/API failures into safe, actionable UI copy. */
export function presentError(error: unknown): UserFacingError {
  if (error instanceof APIError) {
    if (error.status === 0)
      return { message: "The local API is unavailable. Check that it is running, then try again.", canRetry: true };
    if (error.status === 404) return { message: "The requested record could not be found.", canRetry: false };
    if (error.status === 400 || error.status === 422)
      return { message: "Some information is invalid. Review the fields and try again.", canRetry: false };
    if (error.status === 409)
      return { message: "This change conflicts with a newer version. Refresh and try again.", canRetry: true };
    if (error.status >= 500)
      return { message: "The local API encountered a problem. Try again in a moment.", canRetry: true };
    return { message: "The request could not be completed.", canRetry: true };
  }
  if (error instanceof Error && error.name === "AbortError")
    return { message: "The request was cancelled.", canRetry: true };
  return { message: "Something went wrong. Try again, and contact support if the problem continues.", canRetry: true };
}
