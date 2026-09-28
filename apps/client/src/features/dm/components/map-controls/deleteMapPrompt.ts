// What DELETE says before a saved map goes for good — each line only when it
// applies, each true of the server's map-studio-delete: the map's suspended
// scene is deleted with it, a World location using it becomes a promise again
// and loses its door links, and the table's own map leaves the scene playing
// but no longer editable or kept by the next move.

export function deleteMapPrompt({
  name,
  onTable,
  locationName,
}: {
  name: string;
  /** The map is the table's binding, or the scene on the table came from it. */
  onTable: boolean;
  /** The World location that uses this map, if any. */
  locationName?: string;
}): string {
  const lines = [`Delete map "${name}"? This cannot be undone.`];
  lines.push(
    onTable
      ? "It is the map on the table. The party keeps the current scene for now, but it can no " +
          "longer be edited, and it is not kept when another map replaces it: its NPCs, props, " +
          "drawings, background and combat are lost then."
      : "If the party left a scene on this map, that saved scene (its NPCs, props, drawings, " +
          "background and combat) is deleted with it.",
  );
  if (locationName) {
    lines.push(
      `The World location "${locationName}" uses it: that location becomes a promise again, ` +
        "and the door links placed on it are lost.",
    );
  }
  return lines.join("\n\n");
}
