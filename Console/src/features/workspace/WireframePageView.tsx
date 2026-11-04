import { useEffect, useRef, useState, type ReactNode } from "react";
import { GemTextField } from "@gemsforge/ui";
import { Text, XStack, YStack } from "tamagui";
import { WireframeCount, WireframeDescription, WireframeHeader, WireframeHeading, WireframeIcon, WireframeMain, WireframeTitleGroup } from "./WireframePrimitives";

type WireframePageViewProps = {
  title: string;
  description: string;
  recordCount: number;
  children: ReactNode;
  tableIcon?: ReactNode;
  onTitleChange?: (value: string) => void;
  onDescriptionChange?: (value: string) => void;
};

export function WireframePageView({
  title,
  description,
  recordCount,
  tableIcon,
  onTitleChange,
  onDescriptionChange,
  children,
}: WireframePageViewProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftDescription, setDraftDescription] = useState(description);
  const titleFieldRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const descriptionFieldRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const titleEditorRef = useRef<HTMLDivElement>(null);
  const restoreTitleFocus = useRef(false);

  useEffect(() => setDraftTitle(title), [title]);
  useEffect(() => setDraftDescription(description), [description]);
  useEffect(() => {
    if (editingTitle) titleFieldRef.current?.focus();
    else if (restoreTitleFocus.current) {
      restoreTitleFocus.current = false;
      titleEditorRef.current?.querySelector<HTMLButtonElement>(".gem-field-display-value")?.focus();
    }
  }, [editingTitle]);
  useEffect(() => {
    if (editingDescription) descriptionFieldRef.current?.focus();
  }, [editingDescription]);

  const saveTitle = () => {
    const nextTitle = draftTitle.trim();
    if (nextTitle) onTitleChange?.(nextTitle);
    setEditingTitle(false);
  };
  const saveDescription = () => {
    onDescriptionChange?.(draftDescription.trim());
    setEditingDescription(false);
  };

  return (
    <WireframeMain asChild>
      <main className="wireframe-demo-main" aria-labelledby="wireframe-page-title">
        <WireframeHeader asChild>
          <header className="wireframe-page-header">
            <WireframeTitleGroup className="wireframe-page-title-group">
              <WireframeIcon>{tableIcon ?? <Text>✦</Text>}</WireframeIcon>
              <YStack minWidth={0} className="wireframe-page-copy">
                {onTitleChange ? (
                  <div
                    ref={titleEditorRef}
                    id="wireframe-page-title"
                    className="wireframe-page-title-editor"
                    role="heading"
                    aria-level={2}
                  >
                    <GemTextField
                      id="wireframe-page-title-input"
                      label="Page title"
                      showLabel={false}
                      className="wireframe-page-title-field"
                      editing={editingTitle}
                      displayValue={
                        <Text
                          fontSize="$5 desktop:$6"
                          lineHeight="$5 desktop:$6"
                          fontWeight="700"
                          letterSpacing={-0.8}
                          color="$wireframeHeading"
                        >
                          {title}
                        </Text>
                      }
                      onDisplayClick={() => {
                        setDraftTitle(title);
                        setEditingTitle(true);
                      }}
                      value={draftTitle}
                      onChange={(event) => setDraftTitle(event.currentTarget.value)}
                      onBlur={saveTitle}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          restoreTitleFocus.current = true;
                          saveTitle();
                        }
                      }}
                      ref={titleFieldRef}
                      fontSize="$5 desktop:$6"
                      lineHeight="$5 desktop:$6"
                      fontWeight="700"
                      letterSpacing={-0.8}
                    />
                  </div>
                ) : (
                  <WireframeHeading id="wireframe-page-title">{title}</WireframeHeading>
                )}
                {onDescriptionChange ? (
                  <div className="wireframe-page-description wireframe-page-description-editor">
                    <GemTextField
                      id="wireframe-page-description"
                      label="Page description"
                      showLabel={false}
                      multiline
                      rows={3}
                      className="wireframe-page-description-field"
                      editing={editingDescription}
                      displayValue={
                        <Text fontSize="$1" lineHeight="$1" color="$wireframeMuted">
                          {description || "Add a description"}
                        </Text>
                      }
                      onDisplayClick={() => {
                        setDraftDescription(description);
                        setEditingDescription(true);
                      }}
                      value={draftDescription}
                      onChange={(event) => setDraftDescription(event.currentTarget.value)}
                      onBlur={saveDescription}
                      ref={descriptionFieldRef}
                      fontSize="$1"
                      lineHeight="$1"
                    />
                  </div>
                ) : (
                  <WireframeDescription className="wireframe-page-description">{description}</WireframeDescription>
                )}
              </YStack>
            </WireframeTitleGroup>
            <XStack className="wireframe-page-count-group" alignItems="center" gap="$wireframeCard">
              <WireframeCount>{recordCount} records</WireframeCount>
            </XStack>
          </header>
        </WireframeHeader>
      {children}
      </main>
    </WireframeMain>
  );
}
