import type { Entry, EscapeRoot, LayerOwner, LocalSite, Pick } from "./escapeTypes";

export function isLayer(entry: Entry): entry is Entry & { owner: LayerOwner } {
  return ["modal", "popover", "panel"].includes(entry.owner.kind);
}

export function currentEntries(entries: Iterable<[symbol, () => Entry["owner"]]>): Entry[] {
  return Array.from(entries, ([id, read]) => ({ id, owner: read() })).filter(({ owner }) => {
    if (!owner.active) return false;
    if (owner.kind === "modal" || owner.kind === "popover" || owner.kind === "panel") {
      return Boolean(owner.anchor?.isConnected && owner.root.node()?.isConnected);
    }
    return true;
  });
}

/** Positive means a paints later. Only compare known same-document anchors. */
export function compareNodes(a: HTMLElement | null, b: HTMLElement | null): number {
  if (!a || !b || a === b) return 0;
  const position = a.compareDocumentPosition(b);
  if (position & Node.DOCUMENT_POSITION_DISCONNECTED) return 0;
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}

export function compareRoots(a: EscapeRoot, b: EscapeRoot): number {
  return a === b ? 0 : a.band() - b.band() || compareNodes(a.node(), b.node());
}

/** An exact unresolved tie blocks. Array insertion order must never win. */
export function highest<T>(values: T[], compare: (a: T, b: T) => number): Pick<T> {
  if (!values.length) return { state: "none" };
  let best = values[0];
  let tied = false;
  for (const candidate of values.slice(1)) {
    const difference = compare(candidate, best);
    if (difference > 0) {
      best = candidate;
      tied = false;
    } else if (difference === 0 && candidate !== best) {
      tied = true;
    }
  }
  return tied ? { state: "ambiguous" } : { state: "one", value: best };
}

export function foregroundRoot(entries: Entry[], observed: EscapeRoot[] = []): Pick<EscapeRoot> {
  const roots = [
    ...new Set([...observed, ...entries.filter(isLayer).map(({ owner }) => owner.root)]),
  ];
  return highest(roots, compareRoots);
}

function compareLayers(a: Entry & { owner: LayerOwner }, b: Entry & { owner: LayerOwner }) {
  return (
    (a.owner.localBand ?? 0) - (b.owner.localBand ?? 0) ||
    compareNodes(a.owner.anchor, b.owner.anchor)
  );
}

export function foregroundBlocker(entries: Entry[], root: EscapeRoot): Pick<Entry> {
  return highest(
    entries.filter(isLayer).filter(({ owner }) => owner.root === root && owner.kind !== "panel"),
    compareLayers,
  );
}

export function orderedOwner(entries: Entry[], kind: "gesture" | "tool" | "selection") {
  return highest(
    entries.filter((entry) => entry.owner.kind === kind),
    (a, b) => ("order" in a.owner ? a.owner.order : 0) - ("order" in b.owner ? b.owner.order : 0),
  );
}

export function pickEscape(
  entries: Entry[],
  editable: boolean,
  observed: EscapeRoot[] = [],
): Pick<Entry> | { state: "blocked" } {
  const front = foregroundRoot(entries, observed);
  if (front.state === "ambiguous") return front;
  if (front.state === "one") {
    const blocker = foregroundBlocker(entries, front.value);
    if (blocker.state !== "none") return blocker;
  }
  // A native/local editor already had first refusal. A held gesture still wins.
  const gesture = orderedOwner(entries, "gesture");
  if (gesture.state !== "none") return gesture;
  if (front.state === "one") {
    const panel = highest(
      entries
        .filter(isLayer)
        .filter(({ owner }) => owner.root === front.value && owner.kind === "panel"),
      compareLayers,
    );
    if (panel.state !== "none") return panel;
    // A passive visible frame has no new close action, but hidden tools cannot win.
    return { state: "blocked" };
  }
  if (editable) return { state: "none" };
  const tool = orderedOwner(entries, "tool");
  return tool.state === "none" ? orderedOwner(entries, "selection") : tool;
}

export function localSiteEligible(
  entries: Entry[],
  site: LocalSite,
  observed: EscapeRoot[] = [],
): boolean {
  if (!site.anchor?.isConnected) return false;
  const front = foregroundRoot(entries, observed);
  if (front.state === "ambiguous") return false;
  if (front.state === "none") return true;
  if (!site.root) return false;
  if (site.root !== front.value) {
    // An explicit local root may belong to an existing, non-dismissable frame.
    return compareRoots(site.root, front.value) > 0;
  }
  const blocker = foregroundBlocker(entries, front.value);
  if (blocker.state === "ambiguous") return false;
  if (blocker.state === "one") {
    return isLayer(blocker.value) && Boolean(blocker.value.owner.anchor?.contains(site.anchor));
  }
  // Content panels do not outrank gestures in pickEscape. Within one root, however,
  // a retained editor behind a higher panel must not receive local Escape/history.
  const panel = highest(
    entries
      .filter(isLayer)
      .filter(({ owner }) => owner.root === front.value && owner.kind === "panel"),
    compareLayers,
  );
  if (panel.state === "ambiguous") return false;
  return panel.state === "none" || Boolean(panel.value.owner.anchor?.contains(site.anchor));
}

export function hasForegroundModal(entries: Entry[], observed: EscapeRoot[] = []): boolean {
  const front = foregroundRoot(entries, observed);
  // Broken registrations fail conservatively: never publish a held stroke under a modal.
  if (front.state === "ambiguous") return entries.some(({ owner }) => owner.kind === "modal");
  if (front.state === "none") return false;
  return entries.some(({ owner }) => owner.kind === "modal" && owner.root === front.value);
}
