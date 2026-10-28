import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  useCreateGemHueMutation,
  useGemHueQuery,
  useGemHueImageQuery,
  useGemHuePatchMutation,
} from "../../data/recordQueries";
import { QueryFeedback } from "../../components/QueryFeedback";
import type { GemHue, GemHueCreate } from "../../types";
import { EditableRecordFields } from "../../components/EditableRecordFields";
import { CreateFormFrame } from "../../components/forms/CreateForm";
import { GemTextField } from "../../components/ui";

const hueOptions = (values: string[]) => values.map((value) => ({ value, label: value }));
import { api } from "../../api";
import { DatabaseRecordCollection } from "../../components/DatabaseRecordCollection";
import { useRecordUtilities } from "../../hooks/useRecordUtilities";
import { createGemHueTableAdapter } from "../database/recordTableAdapters";

interface GemHuesViewProps {
  hues: GemHue[];
}

/** Shared create workflow for Gem Hues, exposed through the Table Kit action utility. */
function GemHueCreateForm({
  submitting,
  error,
  onCancel,
  onCreate,
}: {
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onCreate: (payload: GemHueCreate) => Promise<void>;
}) {
  const [values, setValues] = useState<GemHueCreate>({
    id: "",
    colorName: "",
    colorFamily: "",
    hexCode: "",
    mood: "",
    palette: "",
    description: "",
    createdDate: "",
    notes: "",
  });
  const update = (field: keyof GemHueCreate) => (event: ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));

  return (
    <CreateFormFrame
      title="Create Gem Hue"
      submitting={submitting}
      error={error}
      onCancel={onCancel}
      onSubmit={() => onCreate(values)}
    >
      <GemTextField label="ID" value={values.id} onChange={update("id")} required width="medium" />
      <GemTextField
        label="Color name"
        value={values.colorName}
        onChange={update("colorName")}
        required
        width="medium"
      />
      <GemTextField
        label="Color family"
        value={values.colorFamily ?? ""}
        onChange={update("colorFamily")}
        width="medium"
      />
      <GemTextField label="Hex code" value={values.hexCode} onChange={update("hexCode")} required width="medium" />
      <GemTextField label="Mood" value={values.mood ?? ""} onChange={update("mood")} width="medium" />
      <GemTextField label="Palette" value={values.palette ?? ""} onChange={update("palette")} width="medium" />
      <GemTextField
        label="Description"
        value={values.description ?? ""}
        onChange={update("description")}
        width="long"
        multiline
      />
      <GemTextField
        label="Created date"
        value={values.createdDate ?? ""}
        onChange={update("createdDate")}
        width="medium"
      />
      <GemTextField label="Notes" value={values.notes ?? ""} onChange={update("notes")} width="long" multiline />
    </CreateFormFrame>
  );
}

export function GemHuesView({ hues }: GemHuesViewProps) {
  const utilities = useRecordUtilities(
    hues,
    (record) => [record.id, record.colorName, record.colorFamily, record.hexCode, record.mood, record.palette],
    {
      name: (a, b) => a.colorName.localeCompare(b.colorName),
      family: (a, b) => (a.colorFamily ?? "").localeCompare(b.colorFamily ?? ""),
      created: (a, b) => (a.createdDate ?? "").localeCompare(b.createdDate ?? ""),
    },
  );
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const detail = useGemHueQuery(selectedID);
  const image = useGemHueImageQuery(selectedID);
  const patch = useGemHuePatchMutation();
  const create = useCreateGemHueMutation();
  const selectedHue = detail.data;
  const [imageURL, setImageURL] = useState<string | null>(null);
  const [galleryImages, setGalleryImages] = useState<Record<string, string>>({});

  const createForm = (close: () => void) => (
    <GemHueCreateForm
      submitting={create.isPending}
      error={create.error instanceof Error ? create.error.message : null}
      onCancel={close}
      onCreate={async (payload) => {
        const created = await create.mutateAsync(payload);
        setSelectedID(created.id);
        close();
      }}
    />
  );

  const actions = {
    newRecordUtility: {
      options: [
        {
          id: "new-gem-hue",
          label: "Input Form",
          description: "Create a Gem Hue record.",
          render: ({ close }: { close: () => void }) => createForm(close),
        },
      ],
    },
  };

  // Load stored logo files for the gallery and release their object URLs when the collection changes.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const objectURLs: string[] = [];

    void Promise.all(
      hues.map(async (hue) => {
        try {
          const response = await api.getGemHueImage(hue.id, controller.signal);
          const blob = await response.blob();
          if (!blob.type.startsWith("image/") || blob.size === 0) return null;
          const url = URL.createObjectURL(blob);
          objectURLs.push(url);
          return [hue.id, url] as const;
        } catch {
          return null;
        }
      }),
    ).then((entries) => {
      if (active) {
        setGalleryImages(
          Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null)),
        );
      }
    });

    return () => {
      active = false;
      controller.abort();
      objectURLs.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [hues]);

  const tableAdapter = useMemo(
    () =>
      createGemHueTableAdapter((hue) => {
        const src = galleryImages[hue.id];
        return src ? { src, alt: `${hue.colorName} logo`, fit: "contain" } : undefined;
      }, async (hue, field, value) => {
        await patch.mutateAsync({ id: hue.id, patch: { [field]: value } });
      }),
    [galleryImages, patch],
  );

  useEffect(() => {
    if (!image.data) {
      setImageURL(null);
      return;
    }
    const url = URL.createObjectURL(image.data);
    setImageURL(url);
    return () => URL.revokeObjectURL(url);
  }, [image.data]);

  function openHue(hueID: string) {
    if (hueID === selectedID) {
      setSelectedID(null);
      setImageURL(null);
      return;
    }
    if (hueID !== selectedID) setImageURL(null);
    setSelectedID(hueID);
  }

  return (
    <>
      <div className="hue-heading">
        <div>
          <p className="eyebrow">Foundation reference data</p>
          <h2>Gem Hues</h2>
          <p className="muted">Colors from the Gem Hues table, with their stored image references.</p>
        </div>
        <div className="hue-heading-actions">
          <span className="record-count">{hues.length} records</span>
        </div>
      </div>
      <DatabaseRecordCollection
        label="Gem Hues"
        records={hues}
        utilities={utilities}
        adapter={tableAdapter}
        sortOptions={[
          { value: "name", label: "Color name" },
          { value: "family", label: "Color family" },
          { value: "created", label: "Created date" },
        ]}
        filterOptions={Array.from(
          new Set(hues.map((hue) => hue.colorFamily).filter((value): value is string => Boolean(value))),
        ).sort()}
        actions={actions}
        detailId={selectedID}
        onDetailChange={(id) => {
          if (id === null) setSelectedID(null);
          else openHue(id);
        }}
        detail={
          selectedID && selectedHue ? (
            <div className="gem-record-expansion">
              <QueryFeedback query={detail} />
              <QueryFeedback query={image} />
              {selectedHue && (
                <section className="hue-detail">
                  <div
                    className="hue-detail-swatch"
                    style={{ "--hue-color": selectedHue.hexCode } as React.CSSProperties}
                  >
                    {imageURL && (
                      <img decoding="async" loading="lazy" src={imageURL} alt={`${selectedHue.colorName} reference`} />
                    )}
                  </div>
                  <div className="hue-detail-copy">
                    <p className="eyebrow">Gem Hue · Foundation reference data</p>
                    <EditableRecordFields
                      className="hue-title-field"
                      fields={[{
                        label: "Color name",
                        value: selectedHue.colorName,
                        editable: true,
                        hideLabel: true,
                        className: "hue-title-value",
                        onSave: async (value) => {
                          await patch.mutateAsync({ id: selectedHue.id, patch: { colorName: String(value ?? "") } });
                        },
                      }]}
                    />
                    <p className="hue-code">
                      {selectedHue.id} · {selectedHue.hexCode}
                    </p>
                    <EditableRecordFields
                      className="hue-fields"
                      fields={[
                        {
                          label: "Color family",
                          value: selectedHue.colorFamily,
                          editable: true,
                          inputType: "select",
                          options: hueOptions([
                            "Red",
                            "Orange",
                            "Yellow",
                            "Green",
                            "Blue",
                            "Purple",
                            "Pink",
                            "Brown",
                            "Gray",
                            "Black",
                            "White",
                          ]),
                          nullable: true,
                          onSave: async (value) => {
                            await patch.mutateAsync({
                              id: selectedHue.id,
                              patch: { colorFamily: value as string | null },
                            });
                          },
                        },
                        {
                          label: "Mood",
                          value: selectedHue.mood,
                          editable: true,
                          inputType: "select",
                          options: hueOptions([
                            "Calm",
                            "Warm",
                            "Cool",
                            "Energizing",
                            "Grounding",
                            "Romantic",
                            "Playful",
                            "Focused",
                          ]),
                          nullable: true,
                          onSave: async (value) => {
                            await patch.mutateAsync({ id: selectedHue.id, patch: { mood: value as string | null } });
                          },
                        },
                        {
                          label: "Palette",
                          value: selectedHue.palette,
                          editable: true,
                          inputType: "select",
                          options: hueOptions([
                            "Monochromatic",
                            "Analogous",
                            "Complementary",
                            "Triadic",
                            "Neutral",
                            "Pastel",
                            "Earth tones",
                          ]),
                          nullable: true,
                          onSave: async (value) => {
                            await patch.mutateAsync({
                              id: selectedHue.id,
                              patch: { palette: value as string | null },
                            });
                          },
                        },
                        {
                          label: "Description",
                          value: selectedHue.description,
                          editable: true,
                          inputType: "longText",
                          nullable: true,
                          onSave: async (value) => {
                            await patch.mutateAsync({
                              id: selectedHue.id,
                              patch: { description: value as string | null },
                            });
                          },
                        },
                        {
                          label: "Notes",
                          value: selectedHue.notes,
                          editable: true,
                          inputType: "longText",
                          nullable: true,
                          className: "record-notes",
                          onSave: async (value) => {
                            await patch.mutateAsync({ id: selectedHue.id, patch: { notes: value as string | null } });
                          },
                        },
                      ]}
                    />
                  </div>
                </section>
              )}
            </div>
          ) : null
        }
      />
    </>
  );
}
