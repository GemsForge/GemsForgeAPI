import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { GMultiSelectField, GemPrimitiveField } from "@gemsforge/ui";
import { GemCaption, GemStatusPill } from "@gemsforge/ui";

type EditableValueProps = {
  value: string;
  label?: string;
  kind?:
    | "text"
    | "select"
    | "status"
    | "number"
    | "date"
    | "url"
    | "email"
    | "relation"
    | "lookup"
    | "multiselect"
    | "textarea";
  options?: readonly (string | { value: string; label: string })[];
  nullable?: boolean;
  displayValue?: ReactNode;
  relatedHref?: string;
  renderEditor?: (props: {
    value: string;
    onChange: (value: string) => void;
    onCommit: (value: string) => Promise<void>;
  }) => ReactNode;
  onCommit?: (value: string) => Promise<void>;
};

export function WireframeEditableValue({
  value,
  label = "Value",
  kind = "text",
  options = [],
  nullable = false,
  onCommit,
  displayValue,
  relatedHref,
  renderEditor,
}: EditableValueProps) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const navigationTimer = useRef<number | undefined>(undefined);
  const lastTouchTap = useRef(0);
  const navigate = useNavigate();
  const [currentValue, setCurrentValue] = useState(value);
  const [editing, setEditing] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const primitive =
    kind === "select" || kind === "status" || kind === "number" || kind === "date" || kind === "url" || kind === "email"
      ? kind
      : "text";
  const commit = async (nextValue: string | number | boolean | null) => {
    const next = String(nextValue ?? "");
    setCurrentValue(next);
    if (onCommit && next !== value) {
      setSaveError(undefined);
      try {
        await onCommit(next);
        return true;
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Could not save this property.");
        return false;
      }
    }
    return true;
  };

  useEffect(() => {
    if (!editing) return;
    fieldRef.current?.querySelector<HTMLElement>("input, textarea, button.create-form-control")?.focus();
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || fieldRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest(".gem-select-content, .gem-date-popover")) return;
      setEditing(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
  }, [editing]);

  useEffect(
    () => () => {
      if (navigationTimer.current !== undefined) window.clearTimeout(navigationTimer.current);
    },
    [],
  );

  useEffect(() => {
    setCurrentValue(value);
    setEditing(false);
    setSaveError(undefined);
  }, [value]);

  const returnToReadOnlyOnBlur = () => {
    window.setTimeout(() => {
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLElement &&
        (fieldRef.current?.contains(activeElement) || activeElement.closest(".gem-select-content, .gem-date-popover"))
      ) {
        return;
      }
      setEditing(false);
    }, 0);
  };

  const startEditing = () => {
    if (navigationTimer.current !== undefined) window.clearTimeout(navigationTimer.current);
    setSaveError(undefined);
    setEditing(true);
  };

  const handleRelationClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
    if (event.detail === 0) {
      if (!relatedHref) event.preventDefault();
      return;
    }
    event.preventDefault();
    if (navigationTimer.current !== undefined) window.clearTimeout(navigationTimer.current);
    if (event.detail > 1) {
      startEditing();
      return;
    }
    if (relatedHref) {
      navigationTimer.current = window.setTimeout(() => navigate(relatedHref), 350);
    }
  };

  const handleRelationPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "touch") return;
    const now = Date.now();
    if (now - lastTouchTap.current <= 350) {
      lastTouchTap.current = 0;
      event.preventDefault();
      startEditing();
      return;
    }
    lastTouchTap.current = now;
  };

  return (
    <div
      ref={fieldRef}
      className="wireframe-editable-value"
      onBlurCapture={(event) => {
        if (editing && !event.currentTarget.contains(event.relatedTarget as Node | null)) returnToReadOnlyOnBlur();
      }}
      onKeyDown={(event) => {
        if (editing || kind !== "relation" || event.key !== "F2") return;
        event.preventDefault();
        startEditing();
      }}
    >
      {editing && kind === "multiselect" ? (
        <GMultiSelectField
          label={label}
          value={currentValue}
          options={options.map((option) => (typeof option === "string" ? { value: option, label: option } : option))}
          error={saveError}
          onSave={async (next) => {
            if (await commit(next)) setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : editing && renderEditor ? (
        <>
          {renderEditor({
            value: currentValue,
            onChange: setCurrentValue,
            onCommit: async (next) => {
              if (await commit(next)) setEditing(false);
            },
          })}
          {saveError ? (
            <p className="wireframe-value-save-error" role="alert">
              {saveError}
            </p>
          ) : null}
        </>
      ) : !editing && (kind === "url" || kind === "email") && currentValue ? (
        <span className="wireframe-action-value">
          <a
            className="primitive-value-link"
            href={kind === "email" ? `mailto:${currentValue}` : currentValue}
            target={kind === "url" ? "_blank" : undefined}
            rel={kind === "url" ? "noreferrer" : undefined}
            onClick={(event) => event.stopPropagation()}
          >
            <GemCaption>{displayValue ?? currentValue}</GemCaption>
          </a>
          <button
            type="button"
            className="wireframe-value-edit-trigger"
            aria-label={`Edit ${label}`}
            title={`Edit ${label}`}
            onClick={(event) => {
              event.stopPropagation();
              setSaveError(undefined);
              setEditing(true);
            }}
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
        </span>
      ) : !editing && kind === "relation" ? (
        <span className="wireframe-action-value">
          {relatedHref ? (
            <a
              className="wireframe-related-record-link"
              href={relatedHref}
              title="Double-click or press F2 to edit"
              onPointerDown={handleRelationPointerDown}
              onClick={handleRelationClick}
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                startEditing();
              }}
            >
              {displayValue ?? currentValue}
            </a>
          ) : (
            <span
              className="wireframe-related-record-link"
              role="group"
              tabIndex={0}
              aria-label={`${label}: no related record; double-click or double-tap, or press F2 to edit`}
              onPointerDown={handleRelationPointerDown}
              onDoubleClick={(event) => {
                event.stopPropagation();
                startEditing();
              }}
            >
              {displayValue ?? <GemCaption>—</GemCaption>}
            </span>
          )}
        </span>
      ) : !editing && kind === "lookup" ? (
        <span className="wireframe-action-value">
          <button
            type="button"
            className="wireframe-structural-value-trigger"
            aria-label={`Search lookup source for ${label}`}
            onClick={(event) => {
              event.stopPropagation();
              startEditing();
            }}
          >
            {displayValue ?? <GemCaption>—</GemCaption>}
          </button>
        </span>
      ) : (
        <GemPrimitiveField
          label={label}
          showLabel={false}
          primitive={primitive}
          value={currentValue}
          editing={editing}
          displayValue={
            kind === "status" ? (
              <GemStatusPill tone="success" wireframe>
                {displayValue ?? (currentValue || "—")}
              </GemStatusPill>
            ) : (
              (displayValue ?? (currentValue || "—"))
            )
          }
          valueTextRole="caption"
          density="compact"
          onDisplayClick={() => {
            setSaveError(undefined);
            setEditing(true);
          }}
          options={
            kind === "select" || kind === "status"
              ? options.map((option) => (typeof option === "string" ? { value: option, label: option } : option))
              : undefined
          }
          nullable={nullable}
          multiline={kind === "textarea"}
          width="long"
          wireframe
          error={saveError}
          onChange={(next) => {
            if (typeof next === "string") setCurrentValue(next);
            if (kind === "select" || kind === "status") setEditing(false);
          }}
          onSave={async (next) => {
            await commit(next);
          }}
          onBlur={returnToReadOnlyOnBlur}
        />
      )}
    </div>
  );
}
