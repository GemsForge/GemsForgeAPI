import React, { useState } from "react";
import { GemCaption } from "@gemsforge/ui";
import { WireframeEditableValue } from "./WireframeEditableValue";
import { WireframePropertyEditor } from "./WireframePropertyEditor";
import type { ReactNode } from "react";
import type { RecordNumberFormat } from "../../table-kit/recordContracts";
import type { RecordPropertyKind } from "../../table-kit/recordContracts";
import type { GemDateFormat } from "@gemsforge/ui";

export type WireframeInspectorField = {
  id: string;
  label: string;
  value: string;
  kind?:
    | "text"
    | "select"
    | "status"
    | "number"
    | "date"
    | "url"
    | "email"
    | "checkbox"
    | "relation"
    | "lookup"
    | "multiselect"
    | "textarea";
  propertyKind?: RecordPropertyKind;
  propertyType?: string;
  iconName?: string;
  numberFormat?: RecordNumberFormat;
  dateFormat?: GemDateFormat;
  includeTime?: boolean;
  onDateConfigChange?: (config: { displayFormat: GemDateFormat; includeTime: boolean }) => void;
  nullable?: boolean;
  options?: readonly (string | { value: string; label: string })[];
  display?: ReactNode;
  displayValue?: ReactNode;
  relatedHref?: string;
  renderEditor?: (props: {
    value: string;
    onChange: (value: string) => void;
    onCommit: (value: string) => Promise<void>;
  }) => ReactNode;
  onCommit?: (value: string) => Promise<void>;
};

export type WireframeInspectorBacklink = {
  id: string;
  label: string;
  href: string;
};

export type WireframeInspectorCoverProps = {
  recordName: string;
  domainHue?: string;
  expandHref?: string;
};

export function WireframeRecordInspector({
  fields,
  cover,
  backlinks,
}: {
  fields: readonly WireframeInspectorField[];
  cover?: WireframeInspectorCoverProps;
  backlinks?: readonly WireframeInspectorBacklink[];
}) {
  const emptyFields = fields.filter((f) => !f.value);
  const filledFields = fields.filter((f) => f.value);
  const [showEmpty, setShowEmpty] = useState(false);
  const visibleFields = showEmpty ? fields : filledFields.length > 0 ? filledFields : fields;

  return (
    <div>
      {cover && (
        <div
          className="wireframe-inspector-cover-strip"
          role={cover.expandHref ? undefined : "region"}
          aria-label={cover.recordName}
          style={cover.domainHue ? ({ "--gem-domain-hue": cover.domainHue } as React.CSSProperties) : undefined}
        >
          <div className="wireframe-inspector-cover-thumbnail" aria-hidden="true">
            <span style={{ fontSize: "0.9rem" }}>✦</span>
          </div>
          <span className="wireframe-inspector-cover-name">{cover.recordName}</span>
          {cover.expandHref && (
            <a href={cover.expandHref} className="wireframe-inspector-cover-expand" aria-label="Open full page">
              ↗
            </a>
          )}
        </div>
      )}
      <dl aria-label="Record properties">
        {visibleFields.map((field) => (
          <div key={field.id}>
            <dt
              data-property-id={field.id}
              data-property-kind={field.propertyKind ?? field.kind ?? "text"}
              data-property-type={field.propertyType}
              data-property-icon={field.iconName}
              data-property-number-format={field.numberFormat}
            >
              <WireframePropertyEditor
                label={field.label}
                value={field.value}
                kind={field.propertyKind ?? field.kind}
                numberFormat={field.numberFormat}
                propertyType={field.propertyType}
                iconName={field.iconName}
                propertyID={field.id}
              />
            </dt>
            <dd>
              {field.onCommit ? (
                <WireframeEditableValue
                  label={field.label}
                  value={field.value}
                  displayValue={field.displayValue}
                  relatedHref={field.relatedHref}
                  kind={field.kind}
                  dateFormat={field.dateFormat}
                  includeTime={field.includeTime}
                  onDateConfigChange={field.onDateConfigChange}
                  options={field.options}
                  nullable={field.nullable}
                  renderEditor={field.renderEditor}
                  onCommit={field.onCommit}
                />
              ) : field.kind === "url" && field.value ? (
                <a className="primitive-value-link" href={field.value} target="_blank" rel="noreferrer">
                  <GemCaption>{field.display ?? field.value}</GemCaption>
                </a>
              ) : (
                <GemCaption>{(field.display ?? field.value) || "—"}</GemCaption>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {emptyFields.length > 0 && (
        <button
          type="button"
          className="wireframe-show-empty-toggle"
          aria-expanded={showEmpty}
          onClick={() => setShowEmpty((prev) => !prev)}
        >
          {showEmpty ? `Hide ${emptyFields.length} empty` : `Show ${emptyFields.length} empty`}
          <span aria-hidden="true">{showEmpty ? "↑" : "↓"}</span>
        </button>
      )}
      {backlinks && backlinks.length > 0 && (
        <div className="wireframe-backlinks-panel">
          <p className="wireframe-backlinks-heading" id="inspector-backlinks-label">
            Linked from
          </p>
          <ul className="wireframe-backlinks-list" aria-labelledby="inspector-backlinks-label">
            {backlinks.map((link) => (
              <li key={link.id}>
                <a href={link.href}>
                  <span aria-hidden="true">↩</span>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
