// ============================================================================
// ATOMIC RENAME WITH A WINDOWS-SHAPED RETRY
// ============================================================================
// tmp+rename is the atomic-replace idiom, and rename-over-existing IS atomic
// on Windows too — but Windows refuses the rename with EPERM (or EBUSY) while
// ANY other handle holds the destination for a moment: a sibling process's
// own rename onto the same state file, an indexer, a virus scanner reading
// the bytes that just landed. The dev server, the e2e server and parallel
// vitest workers all target the same state file, so this fires locally as a
// "Failed to save state" that is nothing of the kind — a save that would have
// succeeded ten milliseconds later. Linux never sees it, which is why CI did
// not, and why one contract test that asserts a clean error log flaked here.
//
// A few short retries turn the transient into the atomic replace it is meant
// to be. Anything that is not EPERM/EBUSY is still a real failure and is
// thrown on the first attempt, so a missing directory or a disk error is
// reported exactly as before.

import { rename as fsRename } from "fs/promises";

/** Backoff between attempts; the sum (~400 ms) is the longest a save waits. */
export const RENAME_RETRY_DELAYS_MS: readonly number[] = [10, 30, 90, 270];

const TRANSIENT_CODES = new Set(["EPERM", "EBUSY"]);

export interface RenameWithRetryDeps {
  rename?: (from: string, to: string) => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
  delays?: readonly number[];
}

export async function renameWithRetry(
  from: string,
  to: string,
  deps: RenameWithRetryDeps = {},
): Promise<void> {
  const rename = deps.rename ?? fsRename;
  const sleep = deps.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const delays = deps.delays ?? RENAME_RETRY_DELAYS_MS;
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(from, to);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException | undefined)?.code;
      const delay = delays[attempt];
      if (!code || !TRANSIENT_CODES.has(code) || delay === undefined) throw err;
      await sleep(delay);
    }
  }
}
