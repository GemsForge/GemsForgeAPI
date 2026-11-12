import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { GemTextField } from "@gemsforge/ui";
import { Text, XStack, YStack } from "tamagui";
import {
  WireframeCount,
  WireframeDescription,
  WireframeHeader,
  WireframeHeading,
  WireframeIcon,
  WireframeMain,
  WireframeTitleGroup,
} from "./WireframePrimitives";

type WireframePageViewProps = {
  title: string;
  description: string;
  recordCount: number;
  countLabel?: { singular: string; plural: string };
  showCount?: boolean;
  banner?: ReactNode;
  children: ReactNode;
  tableIcon?: ReactNode;
  onTitleChange?: (value: string) => void;
  onDescriptionChange?: (value: string) => void;
  domainHue?: string;
  domainLabel?: string;
  metaItems?: ReadonlyArray<{ label: string; value: string }>;
  showCoverBanner?: boolean;
};

export function WireframePageView({
  title,
  description,
  recordCount,
  countLabel = { singular: "record", plural: "records" },
  showCount = true,
  banner,
  tableIcon,
  onTitleChange,
  onDescriptionChange,
  domainHue,
  domainLabel,
  metaItems,
  showCoverBanner = false,
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

  const hueStyle = domainHue ? ({ "--gem-domain-hue": domainHue } as React.CSSProperties) : undefined;

  return (
    <WireframeMain asChild>
      <main className="wireframe-demo-main" aria-labelledby="wireframe-page-title" style={hueStyle}>
        {showCoverBanner && (
          <div className="wireframe-page-cover-banner" aria-hidden="true">
            <div className="wireframe-page-cover-banner-gradient" />
          </div>
        )}
        <WireframeHeader asChild>
          <header className="wireframe-page-header">
            {domainLabel && (
              <nav className="wireframe-breadcrumb" aria-label="Breadcrumb">
                <span
                  className="wireframe-domain-pill-dot"
                  style={domainHue ? { background: domainHue } : undefined}
                />
                <span>{domainLabel}</span>
                <span aria-hidden="true">›</span>
                <span className="wireframe-breadcrumb-current">{title}</span>
              </nav>
            )}
            <WireframeTitleGroup className="wireframe-page-title-group">
              {!showCoverBanner && <WireframeIcon>{tableIcon ?? <span aria-hidden="true">✦</span>}</WireframeIcon>}
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
                {banner ? (
                  <div className="wireframe-page-banner" role="note">
                    {banner}
                  </div>
                ) : null}
              </YStack>
            </WireframeTitleGroup>
            {metaItems && metaItems.length > 0 && (
              <div className="wireframe-page-meta-row" role="list" aria-label="Page metadata">
                {metaItems.map((item) => (
                  <span key={item.label} className="wireframe-page-meta-item" role="listitem">
                    <span className="wireframe-page-meta-label">{item.label}</span>
                    <span className="wireframe-page-meta-value">{item.value}</span>
                  </span>
                ))}
              </div>
            )}
            {showCount ? (
              <XStack className="wireframe-page-count-group" alignItems="center" gap="$wireframeCard">
                <WireframeCount>
                  {recordCount} {recordCount === 1 ? countLabel.singular : countLabel.plural}
                </WireframeCount>
              </XStack>
            ) : null}
          </header>
        </WireframeHeader>
        {children}
      </main>
    </WireframeMain>
  );
}
