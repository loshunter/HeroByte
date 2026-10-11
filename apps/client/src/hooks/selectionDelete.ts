import type { RoomSnapshot } from "@herobyte/shared";

/** What the Delete key removes from a selection, decided before anything is sent. */
export interface SelectionDelete {
  tokens: string[];
  drawings: string[];
  props: string[];
  /** Selected pieces this Delete leaves: locked, the map, or not the viewer's. */
  skipped: number;
  /** Of those, the locked ones (a lock stops everyone, the DM included). */
  locked: number;
}

const idOf = (sceneId: string) => sceneId.slice(sceneId.indexOf(":") + 1);

/**
 * The pieces of `selected` (scene ids: "token:…", "drawing:…", "prop:…") the viewer may
 * delete, as the server decides it: nothing locked, never the map; a DM anything else; a
 * player their own tokens and drawings (or an unowned drawing), and their own props only
 * while the DM lets players manage props (PropDispatcher's delete-prop rule).
 */
export function planSelectionDelete(
  selected: readonly string[],
  snapshot: RoomSnapshot | null,
  isDM: boolean,
  uid: string,
): SelectionDelete {
  const plan: SelectionDelete = { tokens: [], drawings: [], props: [], skipped: 0, locked: 0 };
  for (const id of selected) {
    const obj = snapshot?.sceneObjects?.find((candidate) => candidate.id === id);
    if (obj?.locked) plan.locked += 1;
    let mine = false;
    if (obj && !obj.locked && !id.startsWith("map:")) {
      if (id.startsWith("prop:")) {
        const prop = snapshot?.props?.find((candidate) => candidate.id === idOf(id));
        mine = isDM || (snapshot?.playerPropsEnabled === true && prop?.owner === uid);
      } else {
        mine = isDM || !obj.owner || obj.owner === uid;
      }
    }
    if (!mine) plan.skipped += 1;
    else if (id.startsWith("token:")) plan.tokens.push(idOf(id));
    else if (id.startsWith("drawing:")) plan.drawings.push(idOf(id));
    else if (id.startsWith("prop:")) plan.props.push(idOf(id));
    else plan.skipped += 1;
  }
  return plan;
}

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/** "Delete 2 tokens and 1 prop? This cannot be undone." */
export function deleteConfirmText(plan: SelectionDelete): string {
  const parts = [
    plan.tokens.length > 0 ? count(plan.tokens.length, "token") : null,
    plan.drawings.length > 0 ? count(plan.drawings.length, "drawing") : null,
    plan.props.length > 0 ? count(plan.props.length, "prop") : null,
  ].filter((part): part is string => part !== null);
  return `Delete ${parts.join(" and ")}? This cannot be undone.`;
}
