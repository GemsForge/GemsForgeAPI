import type { ReactNode, Ref } from "react";
import { createPortal } from "react-dom";
import { GSelectField, GemButton, GemTextField } from "@gemsforge/ui";
import { SizableText, Theme } from "tamagui";
import { PropertyIcon, PropertyIconPicker } from "./PropertyIconPicker";
import { keepDialogTabFocus } from "./WireframePropertyEditor";
import { WIREFRAME_PROPERTY_TYPES } from "./propertyMetadata";

export type WireframePropertyDetails = {
  id: string;
  label: string;
  value: string;
  type: string;
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
            options={[...new Set([...WIREFRAME_PROPERTY_TYPES, property.type])].map((type) => ({
              value: type,
              label: type,
            }))}
            onChange={(type) => onChange({ ...property, type })}
            wireframe
          />
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
              Save relation and lookup changes with the button in that section. This button saves the property icon
              only.
            </p>
          ) : null}
          <div className="wireframe-property-details-actions">
            <GemButton type="button" variant="outlined" tone="secondary" onClick={onClose}>
              Cancel
            </GemButton>
            <GemButton
              type="button"
              aria-label={children ? "Save property icon" : "Save property settings"}
              onClick={onSave}
            >
              {children ? "Save icon" : "Save"}
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
