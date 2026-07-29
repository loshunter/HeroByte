// Global single-key shortcut handlers (Escape closes the active tool, Ctrl+Z
// undoes the live map or a selection, Delete/Backspace deletes scene objects)
// listen on window, so they would otherwise fire while the user is TYPING —
// in the chat box, the brush-deck or asset-picker search, an inspector field.
// Every such handler must skip events that originate in a typing surface;
// this is the one shared definition of "typing surface".

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
