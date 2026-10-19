import { usePagedRecords } from "../../hooks/usePagedRecords";
import { PaginationControls } from "../../components/PaginationControls";
import { useEffect, useState } from "react";
import { useGemHueQuery, useGemHueImageQuery, useGemHuePatchMutation } from "../../data/recordQueries";
import { QueryFeedback } from "../../components/QueryFeedback";
import type { GemHue } from "../../types";
import { EditableRecordFields } from "../../components/EditableRecordFields";

const hueOptions = (values: string[]) => values.map((value) => ({ value, label: value }));

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
        <span className="record-count">{hues.length} records</span>
      </div>
      <div className="hue-list">
        {paging.items.map((hue) => (
          <button
            className={`hue-card ${selectedHue?.id === hue.id ? "selected" : ""}`}
            key={hue.id}
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
        ))}
      </div>
      <QueryFeedback query={detail} />
      <QueryFeedback query={image} />
      {selectedHue && (
        <section className="hue-detail">
          <div className="hue-detail-swatch" style={{ "--hue-color": selectedHue.hexCode } as React.CSSProperties}>
            {imageURL && (
              <img decoding="async" loading="lazy" src={imageURL} alt={`${selectedHue.colorName} reference`} />
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
                { label: "Color family", value: selectedHue.colorFamily, inputType: "select", options: hueOptions(["Red", "Orange", "Yellow", "Green", "Blue", "Purple", "Pink", "Brown", "Gray", "Black", "White"]), nullable: true, onSave: async (value) => { await patch.mutateAsync({ id: selectedHue.id, patch: { colorFamily: value as string | null } }); } },
                { label: "Mood", value: selectedHue.mood, inputType: "select", options: hueOptions(["Calm", "Warm", "Cool", "Energizing", "Grounding", "Romantic", "Playful", "Focused"]), nullable: true, onSave: async (value) => { await patch.mutateAsync({ id: selectedHue.id, patch: { mood: value as string | null } }); } },
                { label: "Palette", value: selectedHue.palette, inputType: "select", options: hueOptions(["Monochromatic", "Analogous", "Complementary", "Triadic", "Neutral", "Pastel", "Earth tones"]), nullable: true, onSave: async (value) => { await patch.mutateAsync({ id: selectedHue.id, patch: { palette: value as string | null } }); } },
                { label: "Description", value: selectedHue.description, inputType: "longText", nullable: true, onSave: async (value) => { await patch.mutateAsync({ id: selectedHue.id, patch: { description: value as string | null } }); } },
                { label: "Notes", value: selectedHue.notes, inputType: "longText", nullable: true, className: "record-notes", onSave: async (value) => { await patch.mutateAsync({ id: selectedHue.id, patch: { notes: value as string | null } }); } },
              ]}
            />
          </div>
        </section>
      )}
    </>
  );
}
