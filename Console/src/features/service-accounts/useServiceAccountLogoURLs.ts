import { useEffect, useState } from "react";
import { api } from "../../api";
import type { ServiceAccount, ServiceLogo } from "../../types";

/** Loads current attachment-backed logos, with legacy logo-key assets as a fallback. */
export function useServiceAccountLogoURLs(
  records: readonly ServiceAccount[],
  logos: readonly ServiceLogo[] | undefined,
): Record<number, string> {
  const [logoURLs, setLogoURLs] = useState<Record<number, string>>({});

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const objectURLs: string[] = [];

    void Promise.all(
      records.map(async (record) => {
        const legacyLogo = logos?.find((logo) => logo.logoKey === record.logoKey);
        let blob: Blob | undefined;

        if (record.logoFileMetadataID) {
          try {
            blob = await api.getFileContent(record.logoFileMetadataID, controller.signal);
          } catch {
            // Continue to the legacy asset if this attachment is missing.
          }
        }

        if ((!blob || blob.size === 0 || !blob.type.toLowerCase().startsWith("image/")) && legacyLogo) {
          try {
            blob = await api.getServiceLogoImage(legacyLogo.id, controller.signal);
          } catch {
            blob = undefined;
          }
        }

        if (!blob || blob.size === 0 || !blob.type.toLowerCase().startsWith("image/")) return null;

        const url = URL.createObjectURL(blob);
        objectURLs.push(url);
        return [record.id, url] as const;
      }),
    ).then((entries) => {
      if (!active) {
        objectURLs.forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      setLogoURLs(Object.fromEntries(entries.filter((entry): entry is readonly [number, string] => entry !== null)));
    });

    return () => {
      active = false;
      controller.abort();
      objectURLs.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [logos, records]);

  return logoURLs;
}
