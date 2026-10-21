import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** A serializable property descriptor used by the reusable configuration UI. */
export interface TablePropertyOption {
  id: string;
  label: string;
  /** New properties are hidden by default when this is false. */
  defaultVisible?: boolean;
}

/** Persistable property metadata for one named database view. */
export interface TablePropertyConfiguration {
  /** All known property IDs in the user-selected display order. */
  order: readonly string[];
  /** Property IDs omitted from the current presentation. */
  hiddenIds: readonly string[];
}

/** A partial configuration accepted by controlled and persisted consumers. */
export type TablePropertyConfigurationInput = Partial<TablePropertyConfiguration>;

/** The view-specific context supplied with a configuration change. */
export interface TableConfigurationChangeContext {
  viewId: string | undefined;
  /** IDs discarded because the current schema no longer contains them. */
  missingPropertyIds: readonly string[];
}

/** Controlled and uncontrolled inputs for persisted property metadata. */
export interface UseTablePropertyConfigurationOptions {
  properties: readonly TablePropertyOption[];
  viewId?: string;
  /** Initial configuration used for every view unless a view override exists. */
  defaultConfiguration?: TablePropertyConfigurationInput;
  /** Approved, consumer-owned metadata keyed by view ID. */
  viewConfigurations?: Readonly<Record<string, TablePropertyConfigurationInput>>;
  /** Controlled configuration for the active view. */
  configuration?: TablePropertyConfiguration;
  /** Called with serializable metadata; the hook never writes to a backend. */
  onConfigurationChange?: (configuration: TablePropertyConfiguration, context: TableConfigurationChangeContext) => void;
}

/** Operations and normalized state exposed by the property configuration hook. */
export interface TablePropertyConfigurationState {
  configuration: TablePropertyConfiguration;
  visibleIds: readonly string[];
  missingPropertyIds: readonly string[];
  setConfiguration: (
    next:
      | TablePropertyConfigurationInput
      | TablePropertyConfiguration
      | ((current: TablePropertyConfiguration) => TablePropertyConfigurationInput | TablePropertyConfiguration),
  ) => void;
  setVisibility: (propertyId: string, visible: boolean) => void;
  move: (propertyId: string, direction: "up" | "down") => void;
  showAll: () => void;
  hideAll: () => void;
  reset: () => void;
}

/** Normalize persisted property metadata against the current collection schema. */
export function normalizeTablePropertyConfiguration(
  input: TablePropertyConfigurationInput = {},
  properties: readonly TablePropertyOption[],
): { configuration: TablePropertyConfiguration; missingPropertyIds: readonly string[] } {
  const availableIds = properties.map((property) => property.id);
  const available = new Set(availableIds);
  const requestedOrder = input.order ?? availableIds;
  const requestedHidden =
    input.hiddenIds ??
    properties.filter((property) => property.defaultVisible === false).map((property) => property.id);
  const missingPropertyIds = [...new Set([...requestedOrder, ...requestedHidden].filter((id) => !available.has(id)))];
  const order = [...new Set([...requestedOrder.filter((id) => available.has(id)), ...availableIds])];
  const hiddenIds = [...new Set(requestedHidden.filter((id) => available.has(id)))];

  return { configuration: { order, hiddenIds }, missingPropertyIds };
}

/** Filter property options without changing their persisted order. */
export function filterTableProperties(
  properties: readonly TablePropertyOption[],
  search: string,
): readonly TablePropertyOption[] {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) return properties;
  return properties.filter((property) => property.label.toLowerCase().includes(normalizedSearch));
}

/** Manage view-scoped property order and visibility without mutating records. */
export function useTablePropertyConfiguration({
  properties,
  viewId,
  defaultConfiguration,
  viewConfigurations = {},
  configuration: controlledConfiguration,
  onConfigurationChange,
}: UseTablePropertyConfigurationOptions): TablePropertyConfigurationState {
  const defaultState = useMemo(
    () => normalizeTablePropertyConfiguration(defaultConfiguration, properties),
    [defaultConfiguration, properties],
  );
  const configuredState = useMemo(
    () =>
      normalizeTablePropertyConfiguration(
        { ...defaultConfiguration, ...(viewId ? viewConfigurations[viewId] : undefined) },
        properties,
      ),
    [defaultConfiguration, properties, viewConfigurations, viewId],
  );
  const [uncontrolledConfiguration, setUncontrolledConfiguration] = useState<TablePropertyConfiguration>(
    configuredState.configuration,
  );
  const [uncontrolledMissingPropertyIds, setUncontrolledMissingPropertyIds] = useState<readonly string[]>(
    configuredState.missingPropertyIds,
  );
  const viewStates = useRef(new Map<string, TablePropertyConfiguration>());
  const viewMissingPropertyIds = useRef(new Map<string, readonly string[]>());
  const previousViewId = useRef(viewId);
  const currentConfiguration = controlledConfiguration ?? uncontrolledConfiguration;
  const normalizedCurrent = useMemo(() => {
    const normalized = normalizeTablePropertyConfiguration(currentConfiguration, properties);
    return controlledConfiguration === undefined
      ? { configuration: normalized.configuration, missingPropertyIds: uncontrolledMissingPropertyIds }
      : normalized;
  }, [controlledConfiguration, currentConfiguration, properties, uncontrolledMissingPropertyIds]);

  useEffect(() => {
    if (previousViewId.current === viewId) return;
    if (previousViewId.current) {
      viewStates.current.set(previousViewId.current, normalizedCurrent.configuration);
      viewMissingPropertyIds.current.set(previousViewId.current, normalizedCurrent.missingPropertyIds);
    }
    previousViewId.current = viewId;
    if (controlledConfiguration === undefined) {
      setUncontrolledConfiguration(viewStates.current.get(viewId ?? "") ?? configuredState.configuration);
      setUncontrolledMissingPropertyIds(
        viewMissingPropertyIds.current.get(viewId ?? "") ?? configuredState.missingPropertyIds,
      );
    }
  }, [configuredState, controlledConfiguration, normalizedCurrent, viewId]);

  const update = useCallback(
    (next: TablePropertyConfigurationInput | TablePropertyConfiguration) => {
      const resolved = normalizeTablePropertyConfiguration(
        {
          ...currentConfiguration,
          ...next,
        },
        properties,
      );
      if (viewId) viewStates.current.set(viewId, resolved.configuration);
      if (controlledConfiguration === undefined) {
        setUncontrolledConfiguration(resolved.configuration);
        setUncontrolledMissingPropertyIds(resolved.missingPropertyIds);
      }
      onConfigurationChange?.(resolved.configuration, { viewId, missingPropertyIds: resolved.missingPropertyIds });
    },
    [controlledConfiguration, currentConfiguration, onConfigurationChange, properties, viewId],
  );

  const setConfiguration = useCallback(
    (
      next:
        | TablePropertyConfigurationInput
        | TablePropertyConfiguration
        | ((current: TablePropertyConfiguration) => TablePropertyConfigurationInput | TablePropertyConfiguration),
    ) => update(typeof next === "function" ? next(currentConfiguration) : next),
    [currentConfiguration, update],
  );
  const setVisibility = useCallback(
    (propertyId: string, visible: boolean) => {
      const hidden = new Set(currentConfiguration.hiddenIds);
      if (visible) hidden.delete(propertyId);
      else hidden.add(propertyId);
      update({ hiddenIds: [...hidden] });
    },
    [currentConfiguration.hiddenIds, update],
  );
  const move = useCallback(
    (propertyId: string, direction: "up" | "down") => {
      const order = [...currentConfiguration.order];
      const index = order.indexOf(propertyId);
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return;
      [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
      update({ order });
    },
    [currentConfiguration.order, update],
  );
  const showAll = useCallback(() => update({ hiddenIds: [] }), [update]);
  const hideAll = useCallback(
    () => update({ hiddenIds: [...currentConfiguration.order] }),
    [currentConfiguration.order, update],
  );
  const reset = useCallback(() => {
    if (viewId) viewStates.current.delete(viewId);
    const resolved = defaultState.configuration;
    if (controlledConfiguration === undefined) {
      setUncontrolledConfiguration(resolved);
      setUncontrolledMissingPropertyIds(defaultState.missingPropertyIds);
    }
    onConfigurationChange?.(resolved, { viewId, missingPropertyIds: defaultState.missingPropertyIds });
  }, [controlledConfiguration, defaultState, onConfigurationChange, viewId]);

  return useMemo(
    () => ({
      configuration: normalizedCurrent.configuration,
      visibleIds: normalizedCurrent.configuration.order.filter(
        (propertyId) => !normalizedCurrent.configuration.hiddenIds.includes(propertyId),
      ),
      missingPropertyIds: normalizedCurrent.missingPropertyIds,
      setConfiguration,
      setVisibility,
      move,
      showAll,
      hideAll,
      reset,
    }),
    [hideAll, move, normalizedCurrent, reset, setConfiguration, setVisibility, showAll],
  );
}
