import { useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Dialog, Input, SizableText, XStack, YStack } from "tamagui";
import { GemButton } from "@gemsforge/ui";
import { api } from "../../api";
import addressesCover from "../../assets/covers/addresses.png";
import educationCover from "../../assets/covers/education.png";
import employmentCover from "../../assets/covers/employment.png";
import mineralGardenCover from "../../assets/covers/mineral-garden.png";
import quietCoastCover from "../../assets/covers/quiet-coast.png";
import sunstoneTerraceCover from "../../assets/covers/sunstone-terrace.png";
import transactionsCover from "../../assets/covers/transactions.png";
import travelDawnCover from "../../assets/covers/travel-dawn.png";

export type WireframeCover = {
  source: "color" | "gradient" | "gallery" | "upload" | "url";
  presetId?: string;
  imageUrl?: string;
  fileMetadataID?: string;
  position?: { x: number; y: number };
};

export const COVER_PRESETS = [
  { id: "sunstone", label: "Sunstone", value: "linear-gradient(135deg, #e8b17d, #527b82)" },
  { id: "mint", label: "Mint", value: "linear-gradient(135deg, #b7e1d5, #6b9fa0)" },
  { id: "cobalt", label: "Cobalt", value: "linear-gradient(135deg, #5f78b8, #273b63)" },
  { id: "plum", label: "Plum", value: "linear-gradient(135deg, #d7a8c7, #654c78)" },
  {
    id: "sandstone",
    label: "Sandstone texture",
    value: "repeating-linear-gradient(135deg, #d8c3a5 0 8px, #cdb28c 8px 16px)",
  },
] as const;
export const COVER_GALLERY = [
  { id: "education", label: "Education", imageUrl: educationCover },
  { id: "employment", label: "Employment", imageUrl: employmentCover },
  { id: "addresses", label: "Addresses", imageUrl: addressesCover },
  { id: "transactions", label: "Transactions", imageUrl: transactionsCover },
  { id: "travel-dawn", label: "Travel dawn", imageUrl: travelDawnCover },
  { id: "mineral-garden", label: "Mineral garden", imageUrl: mineralGardenCover },
  { id: "sunstone-terrace", label: "Sunstone terrace", imageUrl: sunstoneTerraceCover },
  { id: "quiet-coast", label: "Quiet coast", imageUrl: quietCoastCover },
] as const;
export function validateCoverImageURL(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

type Props = {
  value?: WireframeCover | null;
  onChange?: (cover: WireframeCover | null) => Promise<void> | void;
  onUpload?: (file: File) => Promise<{ id?: string; url?: string } | void>;
  recordKey?: string;
  label?: string;
};

export function getWireframeCoverVisualStyle(cover: WireframeCover | null | undefined): {
  background: string;
  image?: string;
} {
  if (!cover) return { background: COVER_PRESETS[0].value };
  if (cover.source === "gallery") {
    const galleryCover = COVER_GALLERY.find((item) => item.id === cover.presetId);
    if (galleryCover) return { background: "#dfe6e3", image: galleryCover.imageUrl };
  }
  if (cover.imageUrl) return { background: "#dfe6e3", image: cover.imageUrl };
  return { background: COVER_PRESETS.find((preset) => preset.id === cover.presetId)?.value ?? COVER_PRESETS[0].value };
}

function fileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Image upload failed."));
    reader.readAsDataURL(file);
  });
}

export function WireframeCover({ value, onChange, onUpload, recordKey, label = "Record cover" }: Props) {
  const inputId = useId();
  const tabListId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [localCover, setLocalCover] = useState<WireframeCover | null | undefined>(undefined);
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadedImageURL, setUploadedImageURL] = useState<string | null>(null);
  const [tab, setTab] = useState<"gallery" | "upload" | "link">("gallery");
  const [repositioning, setRepositioning] = useState(false);
  const positionX = value?.position?.x ?? 50;
  const positionY = value?.position?.y ?? 50;
  const [position, setPosition] = useState({ x: positionX, y: positionY });
  const positionRef = useRef(position);
  const drag = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const currentCover = value !== undefined ? value : localCover;
  const coverTabIds = ["gallery", "upload", "link"] as const;
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentTab: (typeof coverTabIds)[number]) => {
    const currentIndex = coverTabIds.indexOf(currentTab);
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % coverTabIds.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex + coverTabIds.length - 1) % coverTabIds.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = coverTabIds.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = coverTabIds[nextIndex];
    setTab(nextTab);
    document.getElementById(`${tabListId}-tab-${nextTab}`)?.focus();
  };
  useEffect(() => {
    setLocalCover(undefined);
    const nextPosition = { x: positionX, y: positionY };
    setPosition(nextPosition);
    positionRef.current = nextPosition;
    setRepositioning(false);
    drag.current = null;
  }, [recordKey, positionX, positionY]);
  useEffect(() => {
    if (!currentCover?.fileMetadataID) {
      setUploadedImageURL(null);
      return;
    }
    const controller = new AbortController();
    let objectURL: string | null = null;
    setUploadedImageURL(null);
    void api
      .getFileContent(currentCover.fileMetadataID, controller.signal)
      .then((blob) => {
        objectURL = URL.createObjectURL(blob);
        setUploadedImageURL(objectURL);
      })
      .catch(() => {
        if (!controller.signal.aborted) setUploadedImageURL(null);
      });
    return () => {
      controller.abort();
      if (objectURL) URL.revokeObjectURL(objectURL);
    };
  }, [currentCover?.fileMetadataID]);
  const visualCover =
    currentCover?.fileMetadataID && uploadedImageURL ? { ...currentCover, imageUrl: uploadedImageURL } : currentCover;
  const style = getWireframeCoverVisualStyle(visualCover);
  const save = async (next: WireframeCover | null) => {
    setBusy(true);
    setError(null);
    try {
      setLocalCover(next);
      await onChange?.(next);
      setOpen(false);
    } catch (reason) {
      setLocalCover(currentCover);
      setError(reason instanceof Error ? reason.message : "Cover could not be saved.");
    } finally {
      setBusy(false);
    }
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await onUpload?.(file);
      await save({
        source: "upload",
        fileMetadataID: result?.id,
        imageUrl: result?.id
          ? undefined
          : (result?.url ?? (onUpload ? URL.createObjectURL(file) : await fileAsDataURL(file))),
        position,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Image upload failed.");
      setBusy(false);
    }
  };
  const useLink = () => {
    const url = validateCoverImageURL(link);
    if (!url) {
      setError("Enter a valid http or https image URL.");
      return;
    }
    void save({ source: "url", imageUrl: url, position });
  };
  const reposition = () => setRepositioning((active) => !active);
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!repositioning || (event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startY: event.clientY, originX: position.x, originY: position.y };
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const nextPosition = {
      x: Math.max(0, Math.min(100, drag.current.originX - ((event.clientX - drag.current.startX) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, drag.current.originY - ((event.clientY - drag.current.startY) / rect.height) * 100)),
    };
    setPosition(nextPosition);
    positionRef.current = nextPosition;
  };
  const handlePointerUp = async (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (currentCover) await save({ ...currentCover, position: positionRef.current });
    setRepositioning(false);
  };
  return (
    <YStack className="wireframe-cover" gap="$2" aria-label={label}>
      <div
        className={`wireframe-cover-visual${repositioning ? " is-repositioning" : ""}`}
        style={{ background: style.background }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => void handlePointerUp(event)}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        {style.image ? (
          <img
            className="wireframe-cover-image"
            src={style.image}
            alt={label}
            style={{ objectPosition: `${position.x}% ${position.y}%` }}
          />
        ) : null}
        <XStack className="wireframe-cover-actions" gap={0} role="group" aria-label="Cover actions">
          <GemButton
            className="wireframe-cover-action"
            size="xs"
            tone="secondary"
            aria-label="Change cover"
            onClick={() => {
              setTab("gallery");
              setOpen(true);
            }}
          >
            Change
          </GemButton>
          <GemButton
            className="wireframe-cover-action"
            size="xs"
            tone="secondary"
            aria-label={repositioning ? "Finish repositioning cover" : "Reposition cover"}
            aria-pressed={repositioning}
            onClick={reposition}
          >
            {repositioning ? "Done" : "Reposition"}
          </GemButton>
          {currentCover ? (
            <GemButton
              className="wireframe-cover-action"
              size="xs"
              tone="secondary"
              aria-label="Remove cover"
              onClick={() => void save(null)}
            >
              Remove
            </GemButton>
          ) : null}
        </XStack>
        {repositioning ? (
          <div className="wireframe-cover-reposition-hint" role="status">
            Drag the image to reposition it
          </div>
        ) : null}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay backgroundColor="rgba(16, 35, 38, .58)" />
          <Dialog.Content
            className="wireframe-cover-dialog"
            backgroundColor="#ffffff"
            color="#173d45"
            borderColor="#dfe6e3"
            borderWidth={1}
            borderRadius="$4"
            padding={0}
            width="min(46rem, calc(100vw - 2rem))"
            maxHeight="min(42rem, calc(100vh - 2rem))"
            overflow="hidden"
            aria-label="Change cover"
          >
            <Dialog.Title padding="$4" paddingBottom="$2">
              Change cover
            </Dialog.Title>
            <XStack className="wireframe-cover-tabs" role="tablist" aria-label="Cover source">
              {coverTabIds.map((tabId) => (
                <button
                  key={tabId}
                  id={`${tabListId}-tab-${tabId}`}
                  role="tab"
                  type="button"
                  className="wireframe-cover-source-tab"
                  tabIndex={tab === tabId ? 0 : -1}
                  aria-selected={tab === tabId}
                  aria-controls={`${tabListId}-panel-${tabId}`}
                  onClick={() => setTab(tabId)}
                  onKeyDown={(event) => handleTabKeyDown(event, tabId)}
                >
                  {tabId === "gallery" ? "Gallery" : tabId === "upload" ? "Upload" : "Link"}
                </button>
              ))}
            </XStack>
            {coverTabIds.map((tabId) => (
              <div
                key={tabId}
                id={`${tabListId}-panel-${tabId}`}
                role="tabpanel"
                aria-labelledby={`${tabListId}-tab-${tabId}`}
                tabIndex={0}
                hidden={tab !== tabId}
                className="wireframe-cover-picker"
              >
                <YStack gap="$3">
                  {tabId === "gallery" ? (
                    <>
                      <SizableText className="wireframe-cover-section-label">Record cover gallery</SizableText>
                      <div className="wireframe-cover-presets" aria-label="Record cover gallery">
                        {COVER_GALLERY.map((cover) => (
                          <button
                            className="wireframe-cover-preset"
                            key={cover.id}
                            type="button"
                            aria-label={`Use ${cover.label} cover`}
                            style={{
                              backgroundImage: `url(${cover.imageUrl})`,
                              backgroundPosition: "center",
                              backgroundSize: "cover",
                            }}
                            onClick={() => void save({ source: "gallery", presetId: cover.id, position })}
                          />
                        ))}
                      </div>
                      <SizableText className="wireframe-cover-section-label">Color &amp; gradient</SizableText>
                      <div className="wireframe-cover-presets" aria-label="Cover presets">
                        {COVER_PRESETS.map((preset) => (
                          <button
                            className="wireframe-cover-preset"
                            key={preset.id}
                            type="button"
                            aria-label={`Use ${preset.label} cover`}
                            style={{ background: preset.value }}
                            onClick={() =>
                              void save({
                                source: preset.id === "sandstone" ? "gallery" : "gradient",
                                presetId: preset.id,
                                position,
                              })
                            }
                          />
                        ))}
                      </div>
                    </>
                  ) : null}
                  {tabId === "upload" ? (
                    <>
                      <SizableText>Upload an image from your device.</SizableText>
                      <input id={inputId} ref={fileInput} hidden type="file" accept="image/*" onChange={upload} />
                      <GemButton
                        alignSelf="flex-start"
                        onClick={() => fileInput.current?.click()}
                        aria-label="Upload cover image"
                      >
                        Choose image
                      </GemButton>
                    </>
                  ) : null}
                  {tabId === "link" ? (
                    <>
                      <SizableText>Use an image URL.</SizableText>
                      <XStack gap="$2">
                        <Input aria-label="Image URL" placeholder="https://…" value={link} onChangeText={setLink} />
                        <GemButton onClick={useLink} aria-label="Use image link">
                          Use link
                        </GemButton>
                      </XStack>
                    </>
                  ) : null}
                  {tabId === tab && busy ? <div role="status">Saving cover…</div> : null}
                  {tabId === tab && error ? <div role="alert">{error}</div> : null}
                </YStack>
              </div>
            ))}
            <Dialog.Close asChild>
              <GemButton alignSelf="flex-start" margin="$4" marginTop={0} aria-label="Close change cover dialog">
                Cancel
              </GemButton>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </YStack>
  );
}

export function WireframeCoverCardImage({ cover, alt }: { cover: WireframeCover; alt: string }) {
  const [uploadedImageURL, setUploadedImageURL] = useState<string | null>(null);
  useEffect(() => {
    if (cover.source !== "upload" || !cover.fileMetadataID) {
      setUploadedImageURL(null);
      return;
    }
    const controller = new AbortController();
    let objectURL: string | null = null;
    setUploadedImageURL(null);
    void api
      .getFileContent(cover.fileMetadataID, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectURL = URL.createObjectURL(blob);
        setUploadedImageURL(objectURL);
      })
      .catch(() => {
        if (!controller.signal.aborted) setUploadedImageURL(null);
      });
    return () => {
      controller.abort();
      if (objectURL) URL.revokeObjectURL(objectURL);
    };
  }, [cover.fileMetadataID, cover.source]);

  const style = getWireframeCoverVisualStyle(cover);
  const imageURL = uploadedImageURL ?? style.image;
  return (
    <span className="demo-place-image" style={{ background: style.background }}>
      {imageURL ? (
        <img
          src={imageURL}
          alt={alt}
          style={{ objectPosition: `${cover.position?.x ?? 50}% ${cover.position?.y ?? 50}%` }}
        />
      ) : null}
    </span>
  );
}
