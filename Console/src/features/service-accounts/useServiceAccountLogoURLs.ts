import { useEffect, useState } from "react";
import { api } from "../../api";
import type { ServiceAccount } from "../../types";

/** Loads logos directly from the FileMetadata reference on each service record. */
export function useServiceAccountLogoURLs(records: readonly ServiceAccount[]): Record<number, string> {
  const [logoURLs, setLogoURLs] = useState<Record<number, string>>({});

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const objectURLs: string[] = [];

    void Promise.all(
      records.map(async (record) => {
        if (!record.logoFileMetadataID) return null;
        let blob: Blob;
        try {
          blob = await api.getFileContent(record.logoFileMetadataID, controller.signal);
        } catch {
          return null;
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
  }, [records]);

  return logoURLs;
}
