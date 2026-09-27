import type {
  MapDoorState,
  MapElement,
  MapElementTransform,
  MapElementUpdate,
} from "@herobyte/shared";
import type { MapOperationOutcome } from "../map-studio/mapOperation";

export interface PropertyValues extends MapElementTransform {
  layerId: string;
  hidden: boolean;
  doorState: MapDoorState;
  doorWidth: number;
}
export type PropertyField = keyof PropertyValues;
export type PropertyPart = "properties" | "door";
export const TRANSFORM_FIELDS = ["x", "y", "scaleX", "scaleY", "rotation"] as const;
export const PROPERTY_FIELDS = [...TRANSFORM_FIELDS, "layerId", "hidden"] as const;
export const DOOR_FIELDS = ["doorState", "doorWidth"] as const;

export interface PropertyMember {
  part: PropertyPart;
  values: PropertyValues;
  fields: PropertyField[];
  outcome: MapOperationOutcome | null;
}
export interface PropertyAttempt {
  members: PropertyMember[];
  inspected: boolean;
  refresh?: { status: "pending" | "received" | "failed"; reason?: string };
}
export interface PropertyDraft {
  documentId: string;
  elementId: string;
  values: PropertyValues;
  dirty: Set<PropertyField>;
  removed: boolean;
  attempt?: PropertyAttempt;
}
export interface PropertyView {
  values: PropertyValues;
  dirty: boolean;
  pending: boolean;
  uncertain: boolean;
  canSave: boolean;
  message: string;
  change: <K extends PropertyField>(field: K, value: PropertyValues[K]) => void;
  save: () => void;
  discard: () => void;
  navigation: null | { keep: () => void; discard: () => void; save: () => void };
  recovery: null | {
    refreshing: boolean;
    canInspect: boolean;
    saved: PropertyValues;
    layerName: string;
    isDoor: boolean;
    refresh: () => void;
    inspect: () => void;
  };
}

export function propertyValues(element: MapElement): PropertyValues {
  return {
    ...element.transform,
    layerId: element.layerId,
    hidden: element.hidden,
    doorState: element.type === "door" ? element.data.state : "closed",
    doorWidth: element.type === "door" ? element.data.width : 50,
  };
}
export function draftValues(element: MapElement, draft?: PropertyDraft): PropertyValues {
  const values = propertyValues(element);
  if (draft && !draft.removed)
    for (const field of draft.dirty) Object.assign(values, { [field]: draft.values[field] });
  return values;
}
export function propertyUpdate(
  values: PropertyValues,
  fields: ReadonlySet<PropertyField>,
): MapElementUpdate {
  const update: MapElementUpdate = {};
  if (TRANSFORM_FIELDS.some((field) => fields.has(field))) {
    const { x, y, scaleX, scaleY, rotation } = values;
    update.transform = { x, y, scaleX, scaleY, rotation };
  }
  if (fields.has("layerId")) update.layerId = values.layerId;
  if (fields.has("hidden")) update.hidden = values.hidden;
  return update;
}
export function propertyPending(draft?: PropertyDraft) {
  return Boolean(draft?.attempt?.members.some((member) => !member.outcome));
}
export function propertyUncertain(draft?: PropertyDraft) {
  return Boolean(
    draft?.attempt &&
      !draft.attempt.inspected &&
      draft.attempt.members.some(
        (member) =>
          member.outcome?.status === "failed" && member.outcome.kind === "completion-unavailable",
      ),
  );
}
export function propertyMessage(draft?: PropertyDraft) {
  if (propertyPending(draft))
    return "Saving changes… waiting for the server to confirm each operation.";
  const members = draft?.attempt?.members;
  if (!members) return draft?.dirty.size ? "Unsaved changes." : "No staged changes.";
  if (draft?.attempt?.inspected)
    return "Saved values inspected. Save changes applies only the remaining draft.";
  if (members.every((member) => member.outcome?.status === "succeeded")) return "Changes saved.";
  const results = members
    .map((member) => {
      const label = member.part === "properties" ? "Properties" : "Door settings";
      return member.outcome?.status === "succeeded"
        ? `${label} saved.`
        : member.outcome?.kind === "completion-unavailable"
          ? `${label} completion unconfirmed.`
          : `${label} not saved. ${member.outcome?.reason ?? ""}`;
    })
    .join(" ");
  return (
    results +
    (propertyUncertain(draft) ? " Refresh and inspect the saved values before saving again." : "")
  );
}

export function propertyValidation(values: PropertyValues, door: boolean): string | null {
  if (!TRANSFORM_FIELDS.every((field) => Number.isFinite(values[field])))
    return "Position, scale and rotation must be finite numbers.";
  if (values.scaleX <= 0 || values.scaleY <= 0) return "Scale must be greater than zero.";
  if (
    door &&
    (!Number.isFinite(values.doorWidth) || values.doorWidth < 1 || values.doorWidth > 1000)
  )
    return "Door width must be between 1 and 1000 px.";
  return null;
}
