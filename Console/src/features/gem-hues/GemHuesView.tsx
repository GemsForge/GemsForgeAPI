import { useEffect, useMemo, useState } from "react";
import { useGemHueQuery, useGemHueImageQuery, useGemHuePatchMutation } from "../../data/recordQueries";
import { QueryFeedback } from "../../components/QueryFeedback";
import type { GemHue } from "../../types";
import { EditableRecordFields } from "../../components/EditableRecordFields";

const hueOptions = (values: string[]) => values.map((value) => ({ value, label: value }));
import { api } from "../../api";
import { DatabaseRecordCollection } from "../../components/DatabaseRecordCollection";
import { useRecordUtilities } from "../../hooks/useRecordUtilities";
import { createGemHueTableAdapter } from "../database/recordTableAdapters";

interface GemHuesViewProps {
  hues: GemHue[];
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
  const selectedHue = detail.data;
  const [imageURL, setImageURL] = useState<string | null>(null);
  const [galleryImages, setGalleryImages] = useState<Record<string, string>>({});
  const [ownership, setOwnership] = useState<{ counts: Record<string, number>; message?: string } | null>(null);
  const [ownershipError, setOwnershipError] = useState<string | null>(null);
  const [ownershipBusy, setOwnershipBusy] = useState(false);

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
        setGalleryImages(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null)));
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
      }),
    [galleryImages],
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
      {/* Keep the legacy ownership action in the same safety-panel presentation as Live Database. */}
      <section className="database-panel">
        <div className="database-panel-heading">
          <div>
            <p className="eyebrow">Migration safety</p>
            <h3>Assign existing records to my hub</h3>
          </div>
          <span className="life-mark database-icon" aria-hidden="true">
            ⇄
          </span>
        </div>
        <p className="muted">
          Use this only for legacy rows that already exist with no HubID. It does not create duplicates.
        </p>
        <button
          className="primary-button"
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
      <DatabaseRecordCollection
        label="Gem Hues"
        records={hues}
        utilities={utilities}
        adapter={tableAdapter}
        sortOptions={[{ value: "name", label: "Color name" }, { value: "family", label: "Color family" }, { value: "created", label: "Created date" }]}
        filterOptions={Array.from(new Set(hues.map((hue) => hue.colorFamily).filter((value): value is string => Boolean(value)))).sort()}
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
          ) : null
        }
      />
    </>
  );
}
