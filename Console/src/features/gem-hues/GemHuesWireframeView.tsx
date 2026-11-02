import { useEffect, useState } from "react";
import type { GemHue } from "../../types";
import { api } from "../../api";
import { createGemHueTableAdapter } from "../database/recordTableAdapters";
import { WireframeCollectionView } from "../workspace/WireframeCollectionView";
import { WireframeSchemaInspector } from "../workspace/WireframeSchemaInspector";
import { WireframeImagePreview } from "../workspace/WireframeImagePreview";

export function GemHuesWireframeView({ records }: { records: readonly GemHue[] }) {
  const [imageURLs, setImageURLs] = useState<Record<string, string>>({});
  useEffect(() => {
    const controller = new AbortController();
    const objectURLs: string[] = [];
    void Promise.all(records.map(async (record) => {
      try {
        const response = await api.getGemHueImage(record.id, controller.signal);
        const blob = await response.blob();
        if (!blob.type.startsWith("image/") || blob.size === 0) return null;
        const url = URL.createObjectURL(blob);
        objectURLs.push(url);
        return [record.id, url] as const;
      } catch { return null; }
    })).then((entries) => setImageURLs(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null))));
    return () => { controller.abort(); objectURLs.forEach((url) => URL.revokeObjectURL(url)); };
  }, [records]);
  const adapter = createGemHueTableAdapter((record) => {
    const src = imageURLs[record.id];
    return src ? { src, alt: `${record.colorName} reference`, fit: "contain" } : undefined;
  });
  return (
    <WireframeCollectionView
      config={{
        tableName: "GemHues",
        title: "Gem Hues",
        description: "Foundation colors, palettes, moods, and visual language for GemsForge.",
        activeCollection: "Gem Hues",
        records,
        searchValues: (record) => [
          record.colorName,
          record.colorFamily ?? "",
          record.hexCode,
          record.mood ?? "",
          record.palette ?? "",
        ],
        cardTitle: (record) => record.colorName,
        cardSubtitle: (record) => record.colorFamily ?? "Color family",
        cardStatus: (record) => record.hexCode,
        cardMeta: (record) => record.mood ?? "No mood recorded",
        cardImage: (record) => imageURLs[record.id] ? { src: imageURLs[record.id], alt: `${record.colorName} reference` } : undefined,
        inspector: (record) => (
          <WireframeSchemaInspector
            record={record}
            properties={[
              ...adapter.getPropertyDefinitions(),
              {
                id: "image",
                label: "Image",
                kind: "image",
                getValue: () => {
                  const src = imageURLs[record.id];
                  return src
                    ? { raw: src, display: <WireframeImagePreview src={src} alt={`${record.colorName} reference`} /> }
                    : { display: "No image" };
                },
              },
            ]}
          />
        ),
      }}
    />
  );
}
