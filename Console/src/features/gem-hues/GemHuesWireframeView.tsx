import type { GemHue } from "../../types";
import { createGemHueTableAdapter } from "../database/recordTableAdapters";
import { WireframeCollectionView } from "../workspace/WireframeCollectionView";
import { WireframeSchemaInspector } from "../workspace/WireframeSchemaInspector";

export function GemHuesWireframeView({ records }: { records: readonly GemHue[] }) {
  const adapter = createGemHueTableAdapter();
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
        inspector: (record) => (
          <WireframeSchemaInspector record={record} properties={adapter.getPropertyDefinitions()} />
        ),
      }}
    />
  );
}
