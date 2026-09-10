/**
 * A trailing debounce for the state file.
 *
 * Every broadcast asks for a save, and a held movement key broadcasts ~6.7
 * times a second — ~6.7 full serialisations and tmp+rename writes a second
 * (~100 KB each on the dev table) for one walking token, N× that for a
 * multi-select. A save is a promise the LATEST state reaches disk, not that
 * every intermediate one does, so a burst of requests collapses into one
 * write `SAVE_DEBOUNCE_MS` after the last of them. `flush()` runs a pending
 * request at once: the shutdown path and every test await the write queue
 * through it, so neither waits out the window nor loses the tail.
 *
 * The timer is unref'd: a pending save must never keep a process alive that
 * is otherwise done (the shutdown path flushes explicitly).
 */

export const SAVE_DEBOUNCE_MS = 250;

/** Every debounce with a run pending — so a test teardown can flush the lot. */
const pending = new Set<TrailingDebounce>();

/** Run every pending ask, on every instance, NOW. */
export function flushAllPending(): void {
  for (const debounce of [...pending]) debounce.flush();
}

export class TrailingDebounce {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly waitMs: number,
    private readonly run: () => void,
  ) {}

  /** Ask for a run; an earlier pending ask is superseded, not added. */
  request(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    const timer = setTimeout(() => {
      this.timer = null;
      pending.delete(this);
      this.run();
    }, this.waitMs);
    (timer as { unref?: () => void }).unref?.();
    this.timer = timer;
    pending.add(this);
  }

  /** Run a pending ask NOW (nothing if none is pending). */
  flush(): void {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
    pending.delete(this);
    this.run();
  }

  get pending(): boolean {
    return this.timer !== null;
  }
}
