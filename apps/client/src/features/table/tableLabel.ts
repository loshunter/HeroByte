// ============================================================================
// TABLE LABEL
// ============================================================================
// What a table is called where the header and the Table screen name it: its
// own name (the snapshot carries it once it has arrived), else the name this
// browser remembered when it joined, else the table code, else — on the default
// table, which has no code in its URL — the Main Hall.

export interface TableLabelInput {
  /** `snapshot.tableName`: absent before the snapshot arrives and on the Main Hall. */
  tableName?: string;
  /** The `?room=` code this tab joined, if any. */
  roomId?: string;
  /** The name this browser's table shelf remembered for `roomId`. */
  rememberedName?: string;
}

export function tableLabel({ tableName, roomId, rememberedName }: TableLabelInput): string {
  const name = tableName?.trim() || rememberedName?.trim();
  if (name) return name;
  return roomId ?? "Main Hall";
}
