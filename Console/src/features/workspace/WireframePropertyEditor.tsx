import { useState } from "react";
import { getPropertyIconByName, getPropertyIconDefinition } from "./propertyIcons";
import { PropertyIconPicker } from "./PropertyIconPicker";

export function WireframePropertyEditor({ label, value, kind }: { label: string; value: string; kind?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(label);
  const [type, setType] = useState("Text");
  const [icon, setIcon] = useState(getPropertyIconDefinition(label, kind).name);

  return (
    <>
      <button type="button" className="wireframe-property-details-trigger" aria-label={`Edit ${label} property`} onClick={() => setOpen(true)}>
        {(() => { const Icon = getPropertyIconByName(icon).icon; return <Icon size={13} strokeWidth={2} />; })()}
      </button>
      {label}
      {open ? (
        <div className="wireframe-property-details-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <section className="wireframe-property-details" role="dialog" aria-modal="true" aria-label="Edit property" onClick={(event) => event.stopPropagation()}>
            <button type="button" aria-label="Close property editor" onClick={() => setOpen(false)}>×</button>
            <h3>Edit property</h3>
            <div className="wireframe-property-details-preview"><strong>Current value</strong><p>{value || "No value recorded."}</p></div>
            <label>Property name<input value={name} readOnly={/^(id|item id|record id|primary key)$/i.test(label.trim())} onChange={(event) => setName(event.target.value)} /></label>
            <label>Primitive type<select value={type} onChange={(event) => setType(event.target.value)}><option>Text</option><option>Number</option><option>Date</option><option>Status</option><option>Tags</option><option>URL</option><option>Notes</option></select></label>
            <fieldset className="wireframe-property-icon-fieldset"><legend>Icon</legend><PropertyIconPicker value={icon} onChange={setIcon} /></fieldset>
            <div className="wireframe-property-details-actions"><button type="button" className="wireframe-property-save-button" aria-label="Save property settings" title="Save property settings" onClick={() => setOpen(false)}>✓</button></div>
          </section>
        </div>
      ) : null}
    </>
  );
}
