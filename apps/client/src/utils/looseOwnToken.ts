// The by-owner token fallback, made safe. A character that predates linking
// has no `tokenId`; "the token this uid owns" used to resolve it — and a DM
// owns the NPC tokens they placed, each linked to its NPC character, so a DM's
// unlinked PC resolved to the first goblin (F4's review: the keyboard rule
// moved it, the party panel and the phone list drew it). The safe reading:
// the ONE token the uid owns that no character claims — two is a guess, wrong
// for one of them. One helper, so the three sites agree.

export function looseOwnToken<T extends { id: string; owner: string }>(
  tokens: readonly T[] | undefined,
  characters: ReadonlyArray<{ tokenId?: string | null }> | undefined,
  uid: string,
): T | undefined {
  const claimed = new Set((characters ?? []).flatMap((c) => (c.tokenId ? [c.tokenId] : [])));
  const loose = (tokens ?? []).filter((t) => t.owner === uid && !claimed.has(t.id));
  return loose.length === 1 ? loose[0] : undefined;
}
