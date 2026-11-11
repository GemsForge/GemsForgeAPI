import type { ReactNode, Ref } from "react";
import { createPortal } from "react-dom";
import { GSelectField, GemButton, GemCaption, GemTextField } from "@gemsforge/ui";
import { SizableText, Theme } from "tamagui";
import { PropertyIcon, PropertyIconPicker } from "./PropertyIconPicker";
import { canSavePropertyType, isSelectType, keepDialogTabFocus, parseSelectOptions } from "./WireframePropertyEditor";
import { isWireframePropertyTypeAvailable, WIREFRAME_PROPERTY_TYPES } from "./propertyMetadata";

export type WireframePropertyDetails = {
  id: string;
  label: string;
  value: string;
  type: string;
  kind?: string;
  selectOptions?: string[];
  icon: string;
  statusText: string;
  colorToken: string;
};

export function WireframePropertySettingsDialog({
  property,
  dialogRef,
  onChange,
  onClose,
  onSave,
  children,
}: {
  property: WireframePropertyDetails;
  dialogRef?: Ref<HTMLElement>;
  onChange: (property: WireframePropertyDetails) => void;
  onClose: () => void;
  onSave: () => void;
  children?: ReactNode;
}) {
  return createPortal(
    <Theme name="light">
      <div
        className="wireframe-property-details-backdrop"
        role="presentation"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <section
          ref={dialogRef}
          className="wireframe-property-details"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wireframe-property-details-title"
          tabIndex={-1}
          onKeyDown={(event) => keepDialogTabFocus(event, event.currentTarget)}
        >
          <GemButton
            type="button"
            variant="quiet"
            tone="secondary"
            aria-label="Close property details"
            onClick={onClose}
          >
            ×
          </GemButton>
          <div className="wireframe-property-details-heading">
            <span className="wireframe-property-details-icon" aria-hidden="true">
              <PropertyIcon name={property.icon} />
            </span>
            <div>
              <SizableText
                id="wireframe-property-details-title"
                className="wireframe-property-dialog-title"
                size="$3"
                fontWeight="700"
                role="heading"
                aria-level={2}
              >
                Property settings
              </SizableText>
              <p>{property.label}</p>
            </div>
          </div>
          <div className="wireframe-property-details-preview">
            <strong>Current value</strong>
            <p>{property.value || "No value recorded."}</p>
          </div>
          <GemTextField
            id="wireframe-property-name"
            label="Property name"
            value={property.label}
            readOnly={isIdentityProperty(property.label)}
            onChange={(event) => onChange({ ...property, label: event.currentTarget.value })}
          />
          <GSelectField
            id="wireframe-property-type"
            label="Primitive type"
            value={property.type}
            options={[
              ...new Set([
                ...WIREFRAME_PROPERTY_TYPES.filter((type) =>
                  isWireframePropertyTypeAvailable(type, property.kind, property.type),
                ),
                property.type,
              ]),
            ].map((type) => ({ value: type, label: type }))}
            onChange={(type) => onChange({ ...property, type })}
            wireframe
          />
          {isSelectType(property.type) ? (
            <>
              <GemTextField
                label="Select options (comma-separated; semicolons are reserved)"
                value={(property.selectOptions ?? []).join(", ")}
                onChange={(event) =>
                  onChange({ ...property, selectOptions: parseSelectOptions(event.currentTarget.value) })
                }
              />
              {!property.selectOptions?.length ? (
                <GemCaption>Add at least one option before saving this type.</GemCaption>
              ) : property.type === "Select" && property.kind === "number" ? (
                <GemCaption>Because this column stores numbers, each option must be numeric.</GemCaption>
              ) : null}
            </>
          ) : null}
          <fieldset className="wireframe-property-icon-fieldset">
            <legend>Icon</legend>
            <PropertyIconPicker value={property.icon} onChange={(icon) => onChange({ ...property, icon })} />
          </fieldset>
          <GemTextField
            id="wireframe-property-status-text"
            label="Status text"
            value={property.statusText}
            onChange={(event) => onChange({ ...property, statusText: event.currentTarget.value })}
          />
          <GSelectField
            id="wireframe-property-color"
            label="Pill color"
            value={property.colorToken}
            options={["mint", "gold", "blue", "green", "purple", "orange", "red", "gray"].map((color) => ({
              value: color,
              label: color[0].toUpperCase() + color.slice(1),
            }))}
            onChange={(colorToken) => onChange({ ...property, colorToken })}
            wireframe
          />
          {children}
          {children ? (
            <p className="wireframe-property-details-save-note">
              Save relation and lookup definitions with the button in that section. This button saves the display type,
              options, and icon.
            </p>
          ) : null}
          <div className="wireframe-property-details-actions">
            <GemButton type="button" variant="outlined" tone="secondary" onClick={onClose}>
              Cancel
            </GemButton>
            <GemButton
              type="button"
              aria-label="Save property settings"
              disabled={!canSavePropertyType(property.type, property.kind, (property.selectOptions ?? []).join(","))}
              onClick={onSave}
            >
              Save
            </GemButton>
          </div>
        </section>
      </div>
    </Theme>,
    document.body,
  );
}

function isIdentityProperty(label: string): boolean {
  return /^(id|item id|record id|primary key)$/i.test(label.trim());
}
