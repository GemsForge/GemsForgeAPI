import { useEffect, useState } from "react";
import type { GemHue } from "../../types";
import { api } from "../../api";
import { createGemHueTableAdapter } from "../database/recordTableAdapters";
import { WireframeCollectionView } from "../workspace/WireframeCollectionView";
import { WireframeSchemaInspector } from "../workspace/WireframeSchemaInspector";
import { WireframeImagePreview } from "../workspace/WireframeImagePreview";
import { useCreateGemHueMutation, useGemHuePatchMutation } from "../../data/recordQueries";
import { GemHueCreateForm } from "./GemHuesView";
import type { RecordPropertyDefinition } from "../../table-kit";
import { gemHueFieldDefinitions } from "./gemHueFields";

export function GemHuesWireframeView({ records }: { records: readonly GemHue[] }) {
  const create = useCreateGemHueMutation();
  const patch = useGemHuePatchMutation();
  const [imageURLs, setImageURLs] = useState<Record<string, string>>({});
  const [imageRevision, setImageRevision] = useState(0);
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
  }, [records, imageRevision]);
  const adapter = createGemHueTableAdapter(
    (record) => {
      const src = imageURLs[record.id];
      return src ? { src, alt: `${record.colorName} reference`, fit: "contain" } : undefined;
    },
    (record, field, value) =>
      patch.mutateAsync({ id: record.id, patch: { [field]: value || null } }).then(() => undefined),
  );
  const properties = adapter.getPropertyDefinitions();
  const optionsByProperty = new Map(
    gemHueFieldDefinitions.filter((field) => field.options).map((field) => [field.name, field.options]),
  );
  const editableFields: Record<string, keyof GemHue> = {
    colorName: "colorName",
    colorFamily: "colorFamily",
    hexCode: "hexCode",
    mood: "mood",
    palette: "palette",
    description: "description",
    createdDate: "createdDate",
    notes: "notes",
  };
  return (
    <WireframeCollectionView
      config={{
        tableName: "GemHues",
        title: "Gem Hues",
        description: "Foundation colors, palettes, moods, and visual language for GemsForge.",
        activeCollection: "Gem Hues",
        records,
        properties,
        newRecordUtility: {
          options: [{
            id: "new-gem-hue",
            label: "Input Form",
            description: "Create a Gem Hue record.",
            render: ({ close }) => (
              <GemHueCreateForm
                submitting={create.isPending}
                error={create.error instanceof Error ? create.error.message : null}
                onCancel={close}
                onCreate={async (payload) => {
                  await create.mutateAsync(payload);
                  close();
                }}
              />
            ),
          }],
        },
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
        inspector: (record, schemaProperties) => (
          <WireframeSchemaInspector
            record={record}
            properties={[
              ...properties.map((property): RecordPropertyDefinition<GemHue> => {
                const field = editableFields[property.id];
                return {
                  ...property,
                  edit: field
                    ? {
                        ...property.edit,
                        options: optionsByProperty.get(property.id as keyof GemHue) ?? property.edit?.options,
                        inputType: property.edit?.inputType ?? (property.kind === "date" ? "date" : property.id === "notes" || property.id === "description" ? "longText" : "text"),
                        onSave: property.edit?.onSave ?? ((_record: unknown, value: string | number | null) =>
                          patch.mutateAsync({ id: record.id, patch: { [field]: value || null } }).then(() => undefined)),
                      }
                    : undefined,
                };
              }),
              {
                id: "image",
                label: "Image",
                kind: "image",
                getValue: () => {
                  const src = imageURLs[record.id];
                  return {
                    raw: src,
                    display: (
                      <WireframeImagePreview
                        src={src}
                        alt={`${record.colorName} reference`}
                        onEdit={async (file) => {
                          const metadata = await api.uploadImage(file, "image");
                          await api.patchGemHueImage(record.id, metadata.id);
                          setImageRevision((revision) => revision + 1);
                        }}
                      />
                    ),
                  };
                },
              },
              ...(schemaProperties ?? []),
            ]}
          />
        ),
      }}
    />
  );
}
