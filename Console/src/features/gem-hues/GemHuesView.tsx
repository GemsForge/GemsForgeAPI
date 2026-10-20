import { usePagedRecords } from "../../hooks/usePagedRecords";
import { PaginationControls } from "../../components/PaginationControls";
import { useEffect, useState } from "react";
import { useGemHueQuery, useGemHueImageQuery, useGemHuePatchMutation } from "../../data/recordQueries";
import { QueryFeedback } from "../../components/QueryFeedback";
import type { GemHue } from "../../types";
import { EditableRecordFields } from "../../components/EditableRecordFields";

const hueOptions = (values: string[]) => values.map((value) => ({ value, label: value }));
import { RecordFields } from "../../components/RecordFields";
import { useCreateGemHueMutation } from "../../data/recordQueries";
import { useState as useFormState } from "react";
import type { GemHueCreate } from "../../types";
import { api } from "../../api";

interface GemHuesViewProps {
  hues: GemHue[];
}

export function GemHuesView({ hues }: GemHuesViewProps) {
  const paging = usePagedRecords(hues);
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
  const [importText, setImportText] = useFormState("");
  const [importPreview, setImportPreview] = useFormState<Awaited<ReturnType<typeof api.previewGemHueImport>> | null>(
    null,
  );
  const [importError, setImportError] = useFormState<string | null>(null);
  const [importing, setImporting] = useFormState(false);
  const [ownership, setOwnership] = useFormState<{ counts: Record<string, number>; message?: string } | null>(null);
  const [ownershipError, setOwnershipError] = useFormState<string | null>(null);
  const [ownershipBusy, setOwnershipBusy] = useFormState(false);

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
      <PaginationControls {...paging} label="Gem Hues" />
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
          <button type="button" onClick={() => setShowAdd(false)}>
            Import CSV / JSON
          </button>
        </div>
      </div>
      <section className="record-form">
        <h3>Assign existing records to my hub</h3>
        <p className="muted">
          Use this only for legacy rows that already exist with no HubID. It does not create duplicates.
        </p>
        <button
          type="button"
          disabled={ownershipBusy}
          onClick={async () => {
            setOwnershipBusy(true);
            setOwnershipError(null);
            try {
              const preview = await api.previewHubOwnership();
              setOwnership({ counts: preview.unownedCounts });
            } catch (error) {
              setOwnershipError(error instanceof Error ? error.message : "Could not preview ownership assignment.");
            } finally {
              setOwnershipBusy(false);
            }
          }}
        >
          {ownershipBusy ? "Loading…" : "Preview ownership assignment"}
        </button>
        {ownershipError && <p role="alert">{ownershipError}</p>}
        {ownership && (
          <>
            <p>
              {Object.entries(ownership.counts)
                .filter(([, count]) => count > 0)
                .map(([table, count]) => `${table}: ${count}`)
                .join(" · ") || "No unowned records found."}
            </p>
            <button
              type="button"
              disabled={ownershipBusy || !Object.values(ownership.counts).some((count) => count > 0)}
              onClick={async () => {
                setOwnershipBusy(true);
                setOwnershipError(null);
                try {
                  const result = await api.assignHubOwnership(ownership.counts);
                  setOwnership({
                    counts: {},
                    message: `Assigned ${Object.values(result.assignedCounts).reduce((sum, count) => sum + count, 0)} records.`,
                  });
                } catch (error) {
                  setOwnershipError(error instanceof Error ? error.message : "Could not assign ownership.");
                } finally {
                  setOwnershipBusy(false);
                }
              }}
            >
              Assign existing records
            </button>
            {ownership.message && <p role="status">{ownership.message}</p>}
          </>
        )}
      </section>
      <section className="record-form">
        <h3>Import Gem Hues</h3>
        <p className="muted">
          Paste a CSV export with headers such as HueID, ColorName, and HexCode, or a JSON array using those same names.
        </p>
        <label>
          Choose CSV or JSON file
          <input
            type="file"
            accept=".csv,.json,application/json,text/csv"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) setImportText(await file.text());
            }}
          />
        </label>
        <textarea
          aria-label="Gem Hue CSV or JSON"
          value={importText}
          onChange={(event) => setImportText(event.target.value)}
          rows={6}
        />
        <button
          type="button"
          disabled={importing}
          onClick={async () => {
            setImportError(null);
            setImportPreview(null);
            try {
              let rows: GemHueCreate[];
              if (importText.trim().startsWith("{")) {
                const parsed = JSON.parse(importText);
                const source = Array.isArray(parsed) ? parsed : parsed.GemHues;
                if (!Array.isArray(source)) throw new Error("JSON must contain a GemHues array.");
                rows = source.map((row) => ({
                  id: row.id ?? row.HueID,
                  colorName: row.colorName ?? row.ColorName,
                  colorFamily: row.colorFamily ?? row.ColorFamily ?? null,
                  hexCode: row.hexCode ?? row.HexCode,
                  mood: row.mood ?? row.Mood ?? null,
                  palette: row.palette ?? row.Palette ?? null,
                  description: row.description ?? row.Description ?? null,
                  createdDate: row.createdDate ?? row.CreatedDate ?? null,
                  notes: row.notes ?? row.Notes ?? null,
                }));
              } else if (importText.trim().startsWith("[")) rows = JSON.parse(importText);
              else {
                const [headerLine, ...lines] = importText.trim().split(/\r?\n/);
                const headers = headerLine.split(",").map((value) => value.trim());
                rows = lines
                  .filter(Boolean)
                  .map(
                    (line) =>
                      Object.fromEntries(
                        line.split(",").map((value, index) => [headers[index], value.trim()]),
                      ) as GemHueCreate,
                  );
              }
              setImportPreview(await api.previewGemHueImport(rows));
            } catch (error) {
              setImportError(error instanceof Error ? error.message : "Could not parse the import.");
            }
          }}
        >
          Preview import
        </button>
        {importError && <p role="alert">{importError}</p>}
        {importPreview && (
          <>
            <p>
              {importPreview.validRows.length} valid rows, {importPreview.invalidRows.length} invalid rows.
            </p>
            {importPreview.invalidRows.map((row) => (
              <p role="alert" key={row.rowNumber}>
                Row {row.rowNumber}: {row.errors.join(" ")}
              </p>
            ))}
            <button
              type="button"
              disabled={!importPreview.readyToImport || importing}
              onClick={async () => {
                setImporting(true);
                try {
                  await api.importGemHues(importPreview.validRows);
                  window.location.reload();
                } catch (error) {
                  setImportError(error instanceof Error ? error.message : "Could not publish the import.");
                } finally {
                  setImporting(false);
                }
              }}
            >
              Publish records
            </button>
          </>
        )}
      </section>
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
      <div className="hue-list">
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
