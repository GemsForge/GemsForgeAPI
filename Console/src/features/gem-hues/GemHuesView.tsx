import { useEffect, useState } from "react";
import { api } from "../../api";
import type { GemHue } from "../../types";

interface GemHuesViewProps {
  hues: GemHue[];
}

export function GemHuesView({ hues }: GemHuesViewProps) {
  const [selectedHue, setSelectedHue] = useState<GemHue | null>(null);
  const [imageURL, setImageURL] = useState<string | null>(null);

  useEffect(() => () => { if (imageURL) URL.revokeObjectURL(imageURL); }, [imageURL]);

  async function openHue(hueID: string) {
    const hue = await api.getGemHue(hueID);
    const response = await api.getGemHueImage(hueID);
    if (imageURL) URL.revokeObjectURL(imageURL);
    setImageURL(response.ok ? URL.createObjectURL(await response.blob()) : null);
    setSelectedHue(hue);
  }

  return (
    <>
      <div className="hue-heading"><div><p className="eyebrow">Foundation reference data</p><h2>Gem Hues</h2><p className="muted">Colors from the Gem Hues table, with their stored image references.</p></div><span className="record-count">{hues.length} records</span></div>
      <div className="hue-list">
        {hues.map((hue) => <button className={`hue-card ${selectedHue?.id === hue.id ? "selected" : ""}`} key={hue.id} onClick={() => void openHue(hue.id)}><span className="hue-swatch" style={{ "--hue-color": hue.hexCode } as React.CSSProperties} /><span className="hue-card-copy"><strong>{hue.colorName}</strong><small>{hue.hexCode} · {hue.colorFamily || "Unclassified"}</small></span><span className="arrow">›</span></button>)}
      </div>
      {selectedHue && <section className="hue-detail"><div className="hue-detail-swatch" style={{ "--hue-color": selectedHue.hexCode } as React.CSSProperties}>{imageURL && <img src={imageURL} alt={`${selectedHue.colorName} reference`} />}</div><div className="hue-detail-copy"><p className="eyebrow">Gem Hue · Foundation reference data</p><h3>{selectedHue.colorName}</h3><p className="hue-code">{selectedHue.id} · {selectedHue.hexCode}</p><dl className="hue-fields"><Field label="Color family" value={selectedHue.colorFamily} /><Field label="Mood" value={selectedHue.mood} /><Field label="Palette" value={selectedHue.palette} /><Field label="Description" value={selectedHue.description} /><Field label="Notes" value={selectedHue.notes} /></dl></div></section>}
    </>
  );
}

function Field({ label, value }: { label: string; value: string | null }) { return <div><dt>{label}</dt><dd>{value || "Not specified"}</dd></div>; }
