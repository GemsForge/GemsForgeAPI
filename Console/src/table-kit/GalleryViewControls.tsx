import { Checkbox, Label, Select, SizableText, XStack, YStack } from "tamagui";

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
    <XStack className="table-kit-gallery-controls" aria-label="Gallery display controls" alignItems="flex-end" gap="$3">
      <YStack className="table-kit-gallery-size" gap="$1">
        <Label htmlFor="gallery-card-size">
          <SizableText color="$gemMuted" fontSize="$2">Card size</SizableText>
        </Label>
        <Select value={cardSize} onValueChange={(value) => onCardSizeChange(value as GalleryCardSize)}>
          <Select.Trigger id="gallery-card-size" aria-label="Card size" size="$3" minWidth={120}>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Viewport minWidth={120}>
              <Select.Item value="small"><Select.ItemText>Small</Select.ItemText></Select.Item>
              <Select.Item value="medium"><Select.ItemText>Medium</Select.ItemText></Select.Item>
              <Select.Item value="large"><Select.ItemText>Large</Select.ItemText></Select.Item>
            </Select.Viewport>
          </Select.Content>
        </Select>
      </YStack>
      <XStack className="table-kit-gallery-fit-media" alignItems="center" gap="$2">
        <Checkbox id="gallery-fill-media" size="$3" checked={fillMedia} onCheckedChange={(checked) => onFillMediaChange(checked === true)}>
          <Checkbox.Indicator />
        </Checkbox>
        <Label htmlFor="gallery-fill-media">
          <SizableText color="$gemMuted" fontSize="$2">Fill media</SizableText>
        </Label>
      </XStack>
    </XStack>
  );
}
