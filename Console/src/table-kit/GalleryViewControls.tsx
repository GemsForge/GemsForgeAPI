import { Label, SizableText, Switch, XStack } from "tamagui";
import { GSelectField } from "../components/ui";

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
      <XStack className="table-kit-gallery-fit-media" alignItems="center" gap="$2">
        <Switch
          id="gallery-fill-media"
          size="$3"
          flexShrink={0}
          checked={fillMedia}
          onCheckedChange={onFillMediaChange}
          aria-label="Fill media"
        >
          <Switch.Thumb animation="quick" />
        </Switch>
        <Label htmlFor="gallery-fill-media">
          <SizableText color="$gemMuted" fontSize="$2">Fill media</SizableText>
        </Label>
      </XStack>
    </XStack>
  );
}
