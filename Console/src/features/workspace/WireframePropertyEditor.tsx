import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { SizableText, Theme, type TamaguiElement } from "tamagui";
import { getPropertyIconByName } from "./propertyIcons";
import {
  inferWireframePropertyMetadata,
  isWireframePropertyTypeAvailable,
  WIREFRAME_PROPERTY_TYPES,
} from "./propertyMetadata";
import { PropertyIconPicker } from "./PropertyIconPicker";
import { GemButton, GemCaption } from "@gemsforge/ui";
import { GemTextField } from "@gemsforge/ui";
import { GSelectField } from "@gemsforge/ui";
import type { GemDateFormat } from "@gemsforge/ui";

export const WireframePropertyIconContext = createContext<
  ((propertyID: string, icon: string, type: string, selectOptions: string[]) => void) | null
>(null);
export const WireframePropertyTypeContext = createContext<Readonly<Record<string, string>>>({});
export const WireframePropertySelectOptionsContext = createContext<Readonly<Record<string, string[]>>>({});
export type WireframeDateConfiguration = { displayFormat: GemDateFormat; includeTime: boolean };
export const WireframeDateConfigurationContext = createContext<{
  configurations: Readonly<Record<string, WireframeDateConfiguration>>;
  onChange?: (propertyID: string, configuration: WireframeDateConfiguration) => void;
}>({ configurations: {} });

export function keepDialogTabFocus(event: ReactKeyboardEvent<HTMLElement>, dialog: HTMLElement) {
  if (event.key !== "Tab") return;
  const focusable = [
    ...dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((element) => element.getAttribute("aria-hidden") !== "true");
  if (focusable.length === 0) {
    event.preventDefault();
    dialog.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
    event.preventDefault();
    first.focus();
  }
}

export function WireframePropertyIconProvider({
  children,
  onSave,
  propertyTypes,
  propertySelectOptions,
  dateConfigurations = {},
  onDateConfigurationChange,
}: {
  children: ReactNode;
  onSave: (propertyID: string, icon: string, type: string, selectOptions: string[]) => void;
  propertyTypes: Readonly<Record<string, string>>;
  propertySelectOptions: Readonly<Record<string, string[]>>;
  dateConfigurations?: Readonly<Record<string, WireframeDateConfiguration>>;
  onDateConfigurationChange?: (propertyID: string, configuration: WireframeDateConfiguration) => void;
}) {
  return (
    <WireframePropertyIconContext.Provider value={onSave}>
      <WireframePropertyTypeContext.Provider value={propertyTypes}>
        <WireframePropertySelectOptionsContext.Provider value={propertySelectOptions}>
          <WireframeDateConfigurationContext.Provider
            value={{ configurations: dateConfigurations, onChange: onDateConfigurationChange }}
          >
            {children}
          </WireframeDateConfigurationContext.Provider>
        </WireframePropertySelectOptionsContext.Provider>
      </WireframePropertyTypeContext.Provider>
    </WireframePropertyIconContext.Provider>
  );
}

export function WireframePropertyEditor({
  label,
  value,
  kind,
  numberFormat,
  propertyType,
  iconName,
  propertyID,
}: {
  label: string;
  value: string;
  kind?: string;
  numberFormat?: "decimal" | "currency" | "percent";
  propertyType?: string;
  iconName?: string;
  propertyID?: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(label);
  const metadata = inferWireframePropertyMetadata({ label, kind, numberFormat, propertyType, iconName });
  const [type, setType] = useState(metadata.type);
  const [icon, setIcon] = useState(metadata.iconName);
  const savedSelectOptions = useContext(WireframePropertySelectOptionsContext);
  const [optionText, setOptionText] = useState("");
  const savePropertyIcon = useContext(WireframePropertyIconContext);
  const triggerRef = useRef<TamaguiElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setName(label);
    setType(metadata.type);
    setIcon(metadata.iconName);
    setOptionText((propertyID ? savedSelectOptions[propertyID] : undefined)?.join(", ") ?? "");
  }, [label, metadata.type, metadata.iconName, propertyID, savedSelectOptions]);

  useEffect(() => {
    if (!open) return;
    const triggerElement = triggerRef.current;
    dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (triggerElement?.isConnected) triggerElement.focus();
    };
  }, [open]);

  return (
    <>
      <GemButton
        ref={triggerRef}
        type="button"
        variant="quiet"
        tone="secondary"
        className="wireframe-property-details-trigger"
        aria-label={`Edit ${label} property`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {(() => {
          const Icon = getPropertyIconByName(icon).icon;
          return <Icon size={13} strokeWidth={2} />;
        })()}
      </GemButton>
      <GemCaption className="wireframe-inspector-label" fontWeight="700">
        {label}
      </GemCaption>
      {open && typeof document !== "undefined"
        ? createPortal(
            <Theme name="light">
              <div
                className="wireframe-property-details-backdrop"
                role="presentation"
                onClick={(event) => {
                  if (event.target === event.currentTarget) setOpen(false);
                }}
              >
                <section
                  ref={dialogRef}
                  className="wireframe-property-details"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Edit property"
                  tabIndex={-1}
                  onKeyDown={(event) => keepDialogTabFocus(event, event.currentTarget)}
                >
                  <GemButton
                    type="button"
                    variant="quiet"
                    tone="secondary"
                    aria-label="Close property editor"
                    onClick={() => setOpen(false)}
                  >
                    ×
                  </GemButton>
                  <SizableText
                    className="wireframe-property-dialog-title"
                    size="$3"
                    fontWeight="700"
                    role="heading"
                    aria-level={2}
                  >
                    Edit property
                  </SizableText>
                  <div className="wireframe-property-details-preview">
                    <strong>Current value</strong>
                    <p>{value || "No value recorded."}</p>
                  </div>
                  <GemTextField
                    label="Property name"
                    value={name}
                    readOnly={/^(id|item id|record id|primary key)$/i.test(label.trim())}
                    onChange={(event) => setName(event.currentTarget.value)}
                  />
                  <GSelectField
                    label="Primitive type"
                    value={type}
                    options={[
                      ...new Set([
                        ...WIREFRAME_PROPERTY_TYPES.filter((item) =>
                          isWireframePropertyTypeAvailable(item, kind, type),
                        ),
                        type,
                      ]),
                    ].map((item) => ({
                      value: item,
                      label: item,
                    }))}
                    onChange={setType}
                    wireframe
                  />
                  {isSelectType(type) ? (
                    <>
                      <GemTextField
                        label="Select options (comma-separated; semicolons are reserved)"
                        value={optionText}
                        onChange={(event) => setOptionText(event.currentTarget.value)}
                      />
                      {!parseSelectOptions(optionText).length ? (
                        <GemCaption>Add at least one option before saving this type.</GemCaption>
                      ) : type === "Select" && kind === "number" ? (
                        <GemCaption>Because this column stores numbers, each option must be numeric.</GemCaption>
                      ) : null}
                    </>
                  ) : null}
                  <fieldset className="wireframe-property-icon-fieldset">
                    <legend>Icon</legend>
                    <PropertyIconPicker value={icon} onChange={setIcon} />
                  </fieldset>
                  <div className="wireframe-property-details-actions">
                    <GemButton
                      type="button"
                      variant="outlined"
                      aria-label="Save property settings"
                      disabled={!canSavePropertyType(type, kind, optionText)}
                      onClick={() => {
                        if (propertyID) savePropertyIcon?.(propertyID, icon, type, parseSelectOptions(optionText));
                        setOpen(false);
                      }}
                    >
                      Save
                    </GemButton>
                  </div>
                </section>
              </div>
            </Theme>,
            document.body,
          )
        : null}
    </>
  );
}

export function isSelectType(type: string): boolean {
  return ["Select", "Status", "Multi-select", "Tags"].includes(type);
}

export function parseSelectOptions(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((option) => option.trim())
        .filter((option) => option && !option.includes(";")),
    ),
  ];
}

export function canSavePropertyType(type: string, kind: string | undefined, optionText: string): boolean {
  if (!isSelectType(type)) return true;
  const options = parseSelectOptions(optionText);
  if (options.length === 0) return false;
  return type !== "Select" || kind !== "number" || options.every((option) => Number.isFinite(Number(option)));
}
