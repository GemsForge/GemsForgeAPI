import { usePagedRecords } from "../../hooks/usePagedRecords";
import { PaginationControls } from "../../components/PaginationControls";
import { useEffect, useState } from "react";
import { useGemHueQuery, useGemHueImageQuery } from "../../data/recordQueries";
import { QueryFeedback } from "../../components/QueryFeedback";
import type { GemHue } from "../../types";
import { RecordFields } from "../../components/RecordFields";
import { useCreateGemHueMutation } from "../../data/recordQueries";
import { useState as useFormState } from "react";
import type { GemHueCreate } from "../../types";

interface GemHuesViewProps {
  hues: GemHue[];
}

export function GemHuesView({ hues }: GemHuesViewProps) {
  const paging = usePagedRecords(hues);
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const detail = useGemHueQuery(selectedID);
  const image = useGemHueImageQuery(selectedID);
  const selectedHue = detail.data;
  const [imageURL, setImageURL] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useFormState(false);
  const createHue = useCreateGemHueMutation();
  const [form, setForm] = useFormState<GemHueCreate>({ id: "", colorName: "", colorFamily: "", hexCode: "", mood: "", palette: "", description: "", createdDate: "", notes: "" });

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
        <div className="hue-heading-actions">
          <span className="record-count">{hues.length} records</span>
          <button type="button" onClick={() => setShowAdd((value) => !value)}>{showAdd ? "Close" : "Add Gem Hue"}</button>
        </div>
      </div>
      {showAdd && (
        <form className="record-form" onSubmit={async (event) => {
          event.preventDefault();
          await createHue.mutateAsync(form);
          setForm({ id: "", colorName: "", colorFamily: "", hexCode: "", mood: "", palette: "", description: "", createdDate: "", notes: "" });
          setShowAdd(false);
        }}>
          <h3>Add Gem Hue</h3>
          {(["id", "colorName", "colorFamily", "hexCode", "mood", "palette", "description", "createdDate", "notes"] as const).map((key) => (
            <label key={key}>{key === "id" ? "Hue ID" : key}
              <input required={key === "id" || key === "colorName" || key === "hexCode"} value={form[key] ?? ""} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
            </label>
          ))}
          {createHue.error && <p role="alert">{createHue.error.message}</p>}
          <button type="submit" disabled={createHue.isPending}>{createHue.isPending ? "Adding…" : "Add Gem Hue"}</button>
        </form>
      )}
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
            <RecordFields
              className="hue-fields"
              fields={[
                { label: "Color family", value: selectedHue.colorFamily || "Not specified" },
                { label: "Mood", value: selectedHue.mood || "Not specified" },
                { label: "Palette", value: selectedHue.palette || "Not specified" },
                { label: "Description", value: selectedHue.description || "Not specified" },
                { label: "Notes", value: selectedHue.notes || "Not specified", className: "record-notes" },
              ]}
            />
          </div>
        </section>
      )}
    </>
  );
}
