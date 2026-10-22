import { useEffect, useState } from "react";
import { usePagedRecords } from "../../hooks/usePagedRecords";
import { useGemHueQuery, useGemHueImageQuery, useGemHuePatchMutation } from "../../data/recordQueries";
import { QueryFeedback } from "../../components/QueryFeedback";
import type { GemHue } from "../../types";
import { EditableRecordFields } from "../../components/EditableRecordFields";

const hueOptions = (values: string[]) => values.map((value) => ({ value, label: value }));
import { useCreateGemHueMutation } from "../../data/recordQueries";
import { useState as useFormState } from "react";
import type { GemHueCreate } from "../../types";
import { api } from "../../api";
import { useRecordUtilities } from "../../hooks/useRecordUtilities";
import { DatabaseRecordCollection } from "../../components/DatabaseRecordCollection";
import { gemHueTableAdapter } from "../database/recordTableAdapters";
import { GemHueCreateForm } from "../create/RecordCreateForms";
import { RecordImport } from "../../components/RecordImport";

interface GemHuesViewProps {
  hues: GemHue[];
}

export function GemHuesView({ hues }: GemHuesViewProps) {
  const paging = usePagedRecords(hues);
  const utilities = useRecordUtilities(
    hues,
    (record) => [record.id, record.colorName, record.colorFamily, record.mood, record.palette, record.hexCode],
    {
      name: (a, b) => a.colorName.localeCompare(b.colorName),
      family: (a, b) => (a.colorFamily ?? "").localeCompare(b.colorFamily ?? ""),
      mood: (a, b) => (a.mood ?? "").localeCompare(b.mood ?? ""),
    },
  );
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const detail = useGemHueQuery(selectedID);
  const image = useGemHueImageQuery(selectedID);
  const patch = useGemHuePatchMutation();
  const selectedHue = detail.data;
  const [imageURL, setImageURL] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useFormState(false);
  const createHue = useCreateGemHueMutation();
  const [form, setForm] = useFormState<GemHueCreate>({
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
      {/* Keep import in the shared Add menu so the page header stays focused on primary actions. */}
      <div className="hue-heading">
        <div>
          <p className="eyebrow">Foundation reference data</p>
          <h2>Gem Hues</h2>
          <p className="muted">Colors from the Gem Hues table, with their stored image references.</p>
        </div>
        <div className="hue-heading-actions">
          <span className="record-count">{hues.length} records</span>
          <button type="button" onClick={() => setShowAdd((value) => !value)}>
            {showAdd ? "Close" : "Add Gem Hue"}
          </button>
        </div>
      </div>
      {showAdd && (
        <form
          className="record-form"
          onSubmit={async (event) => {
            event.preventDefault();
            await createHue.mutateAsync(form);
            setForm({
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
            setShowAdd(false);
          }}
        >
          <h3>Add Gem Hue</h3>
          {(
            [
              "id",
              "colorName",
              "colorFamily",
              "hexCode",
              "mood",
              "palette",
              "description",
              "createdDate",
              "notes",
            ] as const
          ).map((key) => (
            <label key={key}>
              {key === "id" ? "Hue ID" : key}
              <input
                required={key === "id" || key === "colorName" || key === "hexCode"}
                value={form[key] ?? ""}
                onChange={(event) => setForm({ ...form, [key]: event.target.value })}
              />
            </label>
          ))}
          {createHue.error && <p role="alert">{createHue.error.message}</p>}
          <button type="submit" disabled={createHue.isPending}>
            {createHue.isPending ? "Adding…" : "Add Gem Hue"}
          </button>
        </form>
      )}
      <DatabaseRecordCollection
        label="Gem Hues"
        records={hues}
        utilities={utilities}
        adapter={gemHueTableAdapter}
        sortOptions={[
          { value: "name", label: "Color name" },
          { value: "family", label: "Color family" },
          { value: "mood", label: "Mood" },
        ]}
        filterOptions={Array.from(new Set(hues.map((hue) => hue.colorFamily).filter(Boolean))).sort() as string[]}
        detailId={selectedID}
        onDetailChange={setSelectedID}
        actions={{
          newRecordUtility: {
            options: [
              {
                id: "new-gem-hue",
                label: "New Gem Hue",
                description: "Create a Gem Hue record.",
                render: ({ close }) => (
                  <GemHueCreateForm
                    onCancel={close}
                    onCreate={async (payload) => {
                      await createHue.mutateAsync(payload);
                      close();
                    }}
                  />
                ),
              },
              {
                id: "import-gem-hue-file",
                label: "Import File",
                description: "Choose a CSV or JSON file.",
                render: ({ close }) => (
                  <RecordImport
                    label="Gem Hues"
                    expectedColumns={["id", "colorName", "hexCode"]}
                    mode="file"
                    open
                    showTrigger={false}
                    onOpenChange={(open) => {
                      if (!open) close();
                    }}
                    onPublish={async (rows) => {
                      await api.importGemHues(rows as GemHueCreate[]);
                      close();
                    }}
                  />
                ),
              },
              {
                id: "paste-gem-hue-data",
                label: "Paste data",
                description: "Paste CSV or JSON records.",
                render: ({ close }) => (
                  <RecordImport
                    label="Gem Hues"
                    expectedColumns={["id", "colorName", "hexCode"]}
                    mode="clipboard"
                    open
                    showTrigger={false}
                    onOpenChange={(open) => {
                      if (!open) close();
                    }}
                    onPublish={async (rows) => {
                      await api.importGemHues(rows as GemHueCreate[]);
                      close();
                    }}
                  />
                ),
              },
            ],
          },
        }}
        detail={
          selectedHue ? (
            <section className="hue-detail">
              <div className="hue-detail-swatch" style={{ "--hue-color": selectedHue.hexCode } as React.CSSProperties}>
                {imageURL && <img src={imageURL} alt={`${selectedHue.colorName} reference`} />}
              </div>
              <div className="hue-detail-copy">
                <p className="eyebrow">Gem Hue · Foundation reference data</p>
                <h3>{selectedHue.colorName}</h3>
                <p className="hue-code">
                  {selectedHue.id} · {selectedHue.hexCode}
                </p>
                <EditableRecordFields
                  className="hue-fields"
                  fields={[
                    {
                      label: "Color family",
                      value: selectedHue.colorFamily,
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
                        await patch.mutateAsync({ id: selectedHue.id, patch: { colorFamily: value as string | null } });
                      },
                    },
                    {
                      label: "Mood",
                      value: selectedHue.mood,
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
                        await patch.mutateAsync({ id: selectedHue.id, patch: { palette: value as string | null } });
                      },
                    },
                    {
                      label: "Description",
                      value: selectedHue.description,
                      inputType: "longText",
                      nullable: true,
                      onSave: async (value) => {
                        await patch.mutateAsync({ id: selectedHue.id, patch: { description: value as string | null } });
                      },
                    },
                    {
                      label: "Notes",
                      value: selectedHue.notes,
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
          ) : selectedID ? (
            <QueryFeedback query={detail} />
          ) : null
        }
      />
      <div className="hue-list" style={{ display: "none" }} aria-hidden="true">
        {paging.items.map((hue) => (
          <div key={hue.id} className="hue-list-item">
            <button
              className={`hue-card ${selectedHue?.id === hue.id ? "selected" : ""}`}
              onClick={() => void openHue(hue.id)}
            >
              <span className="hue-swatch" style={{ "--hue-color": hue.hexCode } as React.CSSProperties} />
              <span className="hue-card-copy">
                <strong>{hue.colorName}</strong>
                <small>
                  {hue.hexCode} · {hue.colorFamily || "Unclassified"}
                </small>
              </span>
              <span className="arrow">›</span>
            </button>
            {selectedID === hue.id && (
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
                        <img
                          decoding="async"
                          loading="lazy"
                          src={imageURL}
                          alt={`${selectedHue.colorName} reference`}
                        />
                      )}
                    </div>
                    <div className="hue-detail-copy">
                      <p className="eyebrow">Gem Hue · Foundation reference data</p>
                      <h3>{selectedHue.colorName}</h3>
                      <p className="hue-code">
                        {selectedHue.id} · {selectedHue.hexCode}
                      </p>
                      <EditableRecordFields
                        className="hue-fields"
                        fields={[
                          {
                            label: "Color family",
                            value: selectedHue.colorFamily,
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
            )}
          </div>
        ))}
      </div>
    </>
  );
}
