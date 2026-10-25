import { XStack } from "tamagui";
import { GSelectField, GSwitch } from "../components/ui";

export type GalleryCardSize = "small" | "medium" | "large";

export interface GalleryViewControlsProps {
  cardSize: GalleryCardSize;
  fillMedia: boolean;
  onCardSizeChange: (size: GalleryCardSize) => void;
  onFillMediaChange: (fill: boolean) => void;
}

/** Shared gallery presentation controls kept separate from record rendering. */
export function GalleryViewControls({
  cardSize,
  fillMedia,
  onCardSizeChange,
  onFillMediaChange,
}: GalleryViewControlsProps) {
  return (
    <XStack
      className="table-kit-gallery-controls"
      aria-label="Gallery display controls"
      alignItems="flex-end"
      flexDirection="row"
      flexWrap="nowrap"
      gap="$3"
    >
      <GSelectField
        label="Card size"
        value={cardSize}
        width="medium"
        options={[
          { value: "small", label: "Small" },
          { value: "medium", label: "Medium" },
          { value: "large", label: "Large" },
        ]}
        onChange={(value) => onCardSizeChange(value as GalleryCardSize)}
      />
      <GSwitch id="gallery-fill-media" label="Fill media" value={fillMedia} onChange={onFillMediaChange} />
    </XStack>
  );
}
