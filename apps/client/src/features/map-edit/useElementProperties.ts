import { useEffect, useReducer, useRef, useState } from "react";
import type { MapStudioController } from "../map-studio/types";
import type { MapOperationHandle } from "../map-studio/mapOperation";
import {
  DOOR_FIELDS,
  PROPERTY_FIELDS,
  draftValues,
  propertyMessage,
  propertyPending,
  propertyUncertain,
  propertyUpdate,
  propertyValues,
  propertyValidation,
  type PropertyAttempt,
  type PropertyDraft,
  type PropertyField,
  type PropertyMember,
  type PropertyView,
} from "./elementProperties";

/** Drafts outlive either inspector. The existing controller remains the only command queue. */
export function useElementProperties(
  controller: MapStudioController,
  selectedId: string | null,
  setSelected: (id: string | null) => void,
  allowed: boolean,
) {
  const drafts = useRef(new Map<string, PropertyDraft>());
  const alive = useRef(true);
  const allowedRef = useRef(allowed);
  allowedRef.current = allowed;
  const [epoch, render] = useReducer((n) => n + 1, 0);
  const [navigation, setNavigation] = useState<{ from: string; to: string | null } | null>(null);
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;
  const document = controller.activeDocument;
  const documentId = document?.id;
  const currentDocument = useRef(documentId);
  currentDocument.current = documentId;
  const element = document?.elements?.find((candidate) => candidate.id === selectedId);
  const key = documentId && element ? JSON.stringify([documentId, element.id]) : null;
  const selectedKey = useRef(key);
  selectedKey.current = key;
  const draft = key ? drafts.current.get(key) : undefined;
  const pending = propertyPending(draft),
    uncertain = propertyUncertain(draft);
  const values = element ? draftValues(element, draft) : null;
  const validation = values && element ? propertyValidation(values, element.type === "door") : null;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    setNavigation(null);
    for (const entry of drafts.current.values())
      if (entry.documentId !== documentId && entry.attempt) entry.attempt.refresh = undefined;
  }, [documentId]);
  useEffect(() => {
    if (!allowed) {
      drafts.current.clear();
      setNavigation(null);
      render();
    }
  }, [allowed]);
  useEffect(() => {
    if (!document?.elements) return;
    let changed = false;
    for (const [id, entry] of drafts.current) {
      if (entry.documentId !== document.id) continue;
      const exists = document.elements.some((candidate) => candidate.id === entry.elementId);
      if (!exists && !entry.removed) {
        entry.removed = true;
        entry.dirty.clear();
        changed = true;
      }
      // An Undo-restored element uses current authority, never the old draft. Keep
      // an outstanding/uncertain attempt as a retry guard until it is resolved.
      if (entry.removed && !propertyPending(entry) && !propertyUncertain(entry)) {
        drafts.current.delete(id);
        changed = true;
      }
    }
    if (changed) render();
  }, [document, epoch]);

  const current = () =>
    alive.current &&
    allowedRef.current &&
    key !== null &&
    selectedKey.current === key &&
    currentDocument.current === documentId;
  const canSave = Boolean(
    values &&
      element &&
      current() &&
      draft?.dirty.size &&
      !pending &&
      !uncertain &&
      !draft.removed &&
      !controller.saving &&
      !controller.loading &&
      !element.locked &&
      !validation,
  );
  const discard = () => {
    if (
      !current() ||
      !key ||
      propertyPending(drafts.current.get(key)) ||
      propertyUncertain(drafts.current.get(key))
    )
      return;
    drafts.current.delete(key);
    render();
  };
  const save = () => {
    if (
      !current() ||
      !canSave ||
      !key ||
      !draft ||
      drafts.current.get(key) !== draft ||
      !values ||
      !element ||
      !documentId ||
      propertyPending(draft) ||
      propertyUncertain(draft)
    )
      return;
    const captured = { ...values };
    const members: PropertyMember[] = [];
    for (const [part, fields] of [
      ["properties", PROPERTY_FIELDS],
      ["door", DOOR_FIELDS],
    ] as const) {
      const dirty = fields.filter((field) => draft.dirty.has(field));
      if (dirty.length) members.push({ part, values: captured, fields: dirty, outcome: null });
    }
    const attempt: PropertyAttempt = { members, inspected: false };
    draft.attempt = attempt;
    render();
    // Enqueue both members in this call, before awaiting either receipt. Their
    // handles retain the original document even if the selection changes later.
    const handles: MapOperationHandle[] = members.map((member) =>
      member.part === "properties"
        ? controller.updateElement(element.id, propertyUpdate(captured, new Set(member.fields)))
        : controller.updateDoor(element.id, {
            state: captured.doorState,
            width: captured.doorWidth,
          }),
    );
    members.forEach((member, index) => {
      const request = handles[index]!;
      void request.completion.then((outcome) => {
        if (!alive.current || drafts.current.get(key) !== draft || draft.attempt !== attempt)
          return;
        member.outcome = outcome;
        if (outcome.status === "succeeded" && !draft.removed)
          for (const field of member.fields) {
            if (draft.values[field] === captured[field]) draft.dirty.delete(field);
          }
        const destination = navigationRef.current;
        if (
          attempt.members.every((item) => item.outcome?.status === "succeeded") &&
          destination?.from === key &&
          selectedKey.current === key
        ) {
          setNavigation(null);
          setSelected(destination.to);
        }
        render();
      });
    });
  };
  const selectElement = (id: string | null) => {
    if (id === selectedId) return;
    if (key && (draft?.dirty.size || pending || uncertain)) {
      setNavigation({ from: key, to: id });
      return;
    }
    setNavigation(null);
    setSelected(id);
  };
  const refresh = () => {
    const attempt = draft?.attempt;
    if (
      !current() ||
      !documentId ||
      !key ||
      !draft ||
      !attempt ||
      !propertyUncertain(draft) ||
      propertyPending(draft) ||
      attempt.refresh?.status === "pending"
    )
      return;
    const receipt: NonNullable<PropertyAttempt["refresh"]> = { status: "pending" };
    attempt.refresh = receipt;
    render();
    controller.openDocument(documentId, (outcome) => {
      if (
        !alive.current ||
        drafts.current.get(key) !== draft ||
        draft.attempt !== attempt ||
        attempt.refresh !== receipt
      )
        return;
      receipt.status = outcome.status;
      if (outcome.status === "failed") receipt.reason = outcome.reason;
      render();
    });
  };
  const inspect = () => {
    const attempt = draft?.attempt;
    if (
      !current() ||
      !element ||
      !draft ||
      !attempt ||
      !propertyUncertain(draft) ||
      propertyPending(draft) ||
      attempt.refresh?.status !== "received"
    )
      return;
    const saved = propertyValues(element);
    // A read receipt is not a save acknowledgement. Inspection only removes
    // already-matching draft fields and unlocks a deliberate remaining save.
    for (const field of draft.dirty)
      if (draft.values[field] === saved[field]) draft.dirty.delete(field);
    attempt.inspected = true;
    render();
  };
  const view: PropertyView | null =
    !allowed || !element || !values || !key || !documentId
      ? null
      : {
          values,
          dirty: Boolean(draft?.dirty.size),
          pending,
          uncertain,
          canSave,
          message:
            propertyMessage(draft) +
            (validation ? ` ${validation}` : "") +
            (draft?.attempt?.refresh?.reason ? ` ${draft.attempt.refresh.reason}` : ""),
          change: (field, value) => {
            if (!current() || controller.loading || element.locked) return;
            let entry = drafts.current.get(key);
            if (propertyPending(entry) || propertyUncertain(entry) || entry?.removed) return;
            if (!entry) {
              entry = {
                documentId,
                elementId: element.id,
                values: { ...values },
                dirty: new Set<PropertyField>(),
                removed: false,
              };
              drafts.current.set(key, entry);
            }
            entry.values = { ...draftValues(element, entry), [field]: value };
            if (value === propertyValues(element)[field]) entry.dirty.delete(field);
            else entry.dirty.add(field);
            entry.attempt = undefined;
            render();
          },
          save,
          discard,
          navigation:
            navigation?.from === key
              ? {
                  keep: () => {
                    if (current() && navigationRef.current === navigation) setNavigation(null);
                  },
                  save,
                  discard: () => {
                    if (!current() || navigationRef.current !== navigation || pending || uncertain)
                      return;
                    discard();
                    setNavigation(null);
                    setSelected(navigation.to);
                  },
                }
              : null,
          recovery: uncertain
            ? {
                refreshing: draft?.attempt?.refresh?.status === "pending",
                canInspect: draft?.attempt?.refresh?.status === "received",
                saved: propertyValues(element),
                layerName:
                  document?.layers.find((layer) => layer.id === element.layerId)?.name ??
                  "Unknown layer",
                isDoor: element.type === "door",
                refresh,
                inspect,
              }
            : null,
        };
  return { properties: view, selectElement };
}
