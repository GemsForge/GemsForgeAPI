import type { ChangeEvent } from "react";

export type GalleryCardSize = "small" | "medium" | "large";

export interface GalleryViewControlsProps {
  cardSize: GalleryCardSize;
  fitMedia: boolean;
  onCardSizeChange: (size: GalleryCardSize) => void;
  onFitMediaChange: (fit: boolean) => void;
}

/** Shared gallery presentation controls kept separate from record rendering. */
export function GalleryViewControls({
  cardSize,
  fitMedia,
  onCardSizeChange,
  onFitMediaChange,
}: GalleryViewControlsProps) {
  const handleSizeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onCardSizeChange(event.target.value as GalleryCardSize);
  };

  return (
    <div className="table-kit-gallery-controls" aria-label="Gallery display controls">
      <label className="table-kit-gallery-size">
        Card size
        <select value={cardSize} onChange={handleSizeChange}>
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </label>
      <label className="table-kit-gallery-fit-media">
        <input type="checkbox" checked={fitMedia} onChange={(event) => onFitMediaChange(event.target.checked)} />
        Fit media
      </label>
    </div>
  );
}
