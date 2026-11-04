import type { Address } from "../../types";

/** Format every available address part for read-only relation displays. */
export function formatAddress(
  address:
    Pick<Address, "addressLine1" | "addressLine2" | "city" | "state" | "postalCode" | "country"> | null | undefined,
): string {
  if (!address) return "Address unavailable";

  const street = [address.addressLine1, address.addressLine2].filter(Boolean).join(", ");
  const locality = [address.city, address.state, address.postalCode].filter(Boolean).join(", ");
  return [street, locality, address.country].filter(Boolean).join(", ") || "Address unavailable";
}
