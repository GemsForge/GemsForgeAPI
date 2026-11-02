import { useEffect, useState } from "react";
import { SizableText, Theme } from "tamagui";
import { getPropertyIconByName } from "./propertyIcons";
import { inferWireframePropertyMetadata, WIREFRAME_PROPERTY_TYPES } from "./propertyMetadata";
import { PropertyIconPicker } from "./PropertyIconPicker";
import { GemButton } from "../../components/ui/GemButton";
import { GemTextField } from "../../components/ui/GemTextField";
import { GSelectField } from "../../components/ui/GSelectField";

export function WireframePropertyEditor({
  label,
  value,
  kind,
  numberFormat,
  propertyType,
  iconName,
}: {
  label: string;
  value: string;
  kind?: string;
  numberFormat?: "decimal" | "currency" | "percent";
  propertyType?: string;
  iconName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(label);
  const metadata = inferWireframePropertyMetadata({ label, kind, numberFormat, propertyType, iconName });
  const [type, setType] = useState(metadata.type);
  const [icon, setIcon] = useState(metadata.iconName);

  useEffect(() => {
    setName(label);
    setType(metadata.type);
    setIcon(metadata.iconName);
  }, [label, metadata.type, metadata.iconName]);

  return (
    <>
      <GemButton type="button" variant="quiet" tone="secondary" className="wireframe-property-details-trigger" aria-label={`Edit ${label} property`} onClick={() => setOpen(true)}>
        {(() => { const Icon = getPropertyIconByName(icon).icon; return <Icon size={13} strokeWidth={2} />; })()}
      </GemButton>
      {label}
      {open ? (
        <Theme name="light">
        <div className="wireframe-property-details-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <section className="wireframe-property-details" role="dialog" aria-modal="true" aria-label="Edit property" onClick={(event) => event.stopPropagation()}>
            <GemButton type="button" variant="quiet" tone="secondary" aria-label="Close property editor" onClick={() => setOpen(false)}>×</GemButton>
            <SizableText className="wireframe-property-dialog-title" size="$3" fontWeight="700" role="heading" aria-level={2}>Edit property</SizableText>
            <div className="wireframe-property-details-preview"><strong>Current value</strong><p>{value || "No value recorded."}</p></div>
            <GemTextField label="Property name" value={name} readOnly={/^(id|item id|record id|primary key)$/i.test(label.trim())} onChange={(event) => setName(event.currentTarget.value)} />
            <GSelectField label="Primitive type" value={type} options={[...new Set([...WIREFRAME_PROPERTY_TYPES, type])].map((item) => ({ value: item, label: item }))} onChange={setType} wireframe />
            <fieldset className="wireframe-property-icon-fieldset"><legend>Icon</legend><PropertyIconPicker value={icon} onChange={setIcon} /></fieldset>
            <div className="wireframe-property-details-actions"><GemButton type="button" variant="outlined" aria-label="Save property settings" onClick={() => setOpen(false)}>✓</GemButton></div>
          </section>
        </div>
        </Theme>
      ) : null}
    </>
  );
}
