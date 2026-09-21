#!/usr/bin/env node
// ============================================================================
// LIVE SESSION CHECK — the post-deploy functional check for session identity
// ============================================================================
// Drives THREE sockets against a running server, as one uid, and asserts the
// behaviour the bundle probe cannot see:
//
//   A  authenticates with the room password         → auth-ok, gets a token
//   B  same uid, room password, NO token            → turned away: the
//                                                     `connection-closing`
//                                                     frame (reason "conflict")
//                                                     arrives BEFORE the close,
//                                                     and no auth-ok
//   C  same uid, room password, A's token           → auth-ok (takeover), and A
//                                                     receives the frame
//                                                     (reason "replaced")
//                                                     BEFORE its close
//
// It also REPORTS the close codes A and B observed. Through Render's proxy a
// server-sent code arrives as 1005 (found live 2026-09-20 — which is why the
// frame exists); on a direct connection it is 4002 / 4003. Either is fine for
// the checks above; the number is printed so a proxy change is noticed.
//
// Why a script: local dev and e2e connect directly, so nothing in the repo's
// gates can see a proxy rewriting a frame. Run this against the real host
// after every deploy that touches the connection lifecycle.
//
// WHAT A RUN LEAVES BEHIND — read before pointing it at a real table:
//   - A joined seat. Authenticating provisions a player, a character and a
//     token for the uid, and a plain disconnect removes none of them. They
//     stay in the table until its idle clear (the public Main Hall wipes
//     itself after an hour empty) or a DM deletes them, and everyone seated
//     sees the token appear. Prefer a scratch private table you own:
//     `--room <id>` with THAT table's password (a custom table opens only
//     with its own password; an id that was never created is not joinable).
//   - One auth-work token from the runner's network budget (20 per IP,
//     refilling one every 2 s): B's turned-away claim is charged and never
//     refunded. Runs minutes apart cost nothing; do not loop it.
//   - A session-token record for the uid, gone after the grace window.
//
// Secrets: the room password comes from HEROBYTE_ROOM_SECRET, as everywhere
// else in this repo. `--secret` overrides it for a one-off and lands in your
// shell history — quote it. PowerShell expands `$` inside double quotes and
// splits on spaces: single-quote every value there.
//
// Usage:
//   HEROBYTE_ROOM_SECRET=... node scripts/live-session-check.mjs --url wss://<host>
//        [--room <roomId>] [--uid <uid>] [--timeout <ms>] [--secret <override>]
//   pnpm check:live-session -- --url 'ws://localhost:8787' --secret 'Fun1'
//
// Needs Node 22+ (the built-in WebSocket client) — newer than this repo's CI
// matrix (18/20); this check never runs in CI. Exit 0 only when all nine
// checks ran and passed; an aborted or short run exits 1.

/** Every check a complete run records, in order; a run that misses one is a FAIL by name. */
const CHECK_NAMES = [
  "A: room password → auth-ok with a session token",
  "B: no token → connection-closing reason 'conflict'",
  "B: the frame arrived BEFORE the close",
  "B: zero auth-ok",
  "A: untouched by B",
  "C: A's token → auth-ok (takeover)",
  "A: connection-closing reason 'replaced'",
  "A: the frame arrived BEFORE the close",
  "C: not told it is being replaced",
];

const args = parseArgs(process.argv.slice(2));
const url = args.url;
const secret = args.secret ?? process.env.HEROBYTE_ROOM_SECRET;
const roomId = args.room;
const uid = args.uid ?? `live-check-${Date.now().toString(36)}`;
const timeoutMs = Number(args.timeout ?? 10_000);

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  console.error(`--timeout must be a positive number of milliseconds, got "${args.timeout}"`);
  process.exit(2);
}
if (!url || !secret) {
  console.error(
    "usage: HEROBYTE_ROOM_SECRET=<room password> live-session-check.mjs --url <ws(s)://host> [--room id] [--uid id] [--timeout ms] [--secret override]",
  );
  process.exit(2);
}
if (typeof WebSocket === "undefined") {
  console.error("Node 22+ is required (built-in WebSocket client).");
  process.exit(2);
}
if (!roomId) {
  console.warn(
    "No --room given: this run joins the DEFAULT table and leaves a live-check seat there (see the header).",
  );
}

/** One counter across every socket: the order events actually arrived in. */
let eventSeq = 0;

/** A socket that records every frame and its close, and can be awaited. */
function openSocket(label) {
  const ws = new WebSocket(`${url}?uid=${encodeURIComponent(uid)}`);
  const record = { label, ws, frames: [], close: null, waiters: [] };
  const notify = () => {
    for (const waiter of [...record.waiters]) waiter();
  };
  ws.addEventListener("message", (event) => {
    let parsed;
    try {
      parsed = JSON.parse(String(event.data));
    } catch {
      return;
    }
    // Snapshots are bare objects with no `t`; only typed frames matter here.
    if (parsed && typeof parsed === "object" && typeof parsed.t === "string") {
      record.frames.push({
        t: parsed.t,
        reason: parsed.reason,
        sessionToken: parsed.sessionToken,
        seq: ++eventSeq,
      });
      notify();
    }
  });
  ws.addEventListener("close", (event) => {
    record.close = { code: event.code, reason: event.reason, seq: ++eventSeq };
    notify();
  });
  ws.addEventListener("error", () => {
    // The close event that follows carries the outcome; nothing to do here.
  });
  record.opened = new Promise((resolve, reject) => {
    // Bounded like every other wait: a host that accepts the connection and
    // never finishes the upgrade must fail the run, not hang it.
    const timer = setTimeout(
      () => reject(new Error(`${label}: timed out waiting for open`)),
      timeoutMs,
    );
    ws.addEventListener(
      "open",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    ws.addEventListener(
      "close",
      () => {
        clearTimeout(timer);
        reject(new Error(`${label}: closed before open`));
      },
      { once: true },
    );
  });
  /** Resolve when `predicate(record)` holds, or reject at the timeout. */
  record.waitFor = (what, predicate) =>
    new Promise((resolve, reject) => {
      const check = () => {
        if (predicate(record)) {
          record.waiters = record.waiters.filter((w) => w !== check);
          clearTimeout(timer);
          resolve();
        }
      };
      const timer = setTimeout(() => {
        record.waiters = record.waiters.filter((w) => w !== check);
        reject(new Error(`${label}: timed out waiting for ${what}`));
      }, timeoutMs);
      record.waiters.push(check);
      check();
    });
  return record;
}

function authenticate(record, token) {
  const frame = { t: "authenticate", secret };
  if (roomId) frame.roomId = roomId;
  if (token) frame.token = token;
  record.ws.send(JSON.stringify(frame));
}

const authOk = (r) => r.frames.filter((f) => f.t === "auth-ok");
const authOutcome = (r) => r.frames.find((f) => f.t === "auth-ok" || f.t === "auth-failed");
/** Wait for the server's answer to an authenticate; throw with its own words if it said no. */
async function awaitAuthOk(record) {
  await record.waitFor("auth-ok", (r) => authOutcome(r) !== undefined);
  const outcome = authOutcome(record);
  if (outcome.t === "auth-failed") {
    throw new Error(`${record.label}: auth-failed — ${outcome.reason ?? "no reason given"}`);
  }
}
const closing = (r) => r.frames.filter((f) => f.t === "connection-closing");
const closedOrAnnounced = (r) => r.close !== null || closing(r).length > 0;

const results = [];
function check(name, pass, observed) {
  if (!CHECK_NAMES.includes(name))
    throw new Error(`unlisted check "${name}" — add it to CHECK_NAMES`);
  results.push({ name, pass, observed });
}

/** Close codes as each socket's close is seen — kept outside main() so an aborted run still reports them. */
const observedCodes = {};
/** Whether B was actually turned away as a conflict (the one outcome that is charged). */
let bTurnedAway = false;

/** The frame must have ARRIVED before the close event, by event order. */
function frameBeforeClose(record) {
  const frame = closing(record)[0];
  if (!frame) return { pass: false, observed: "no frame" };
  if (record.close === null) return { pass: false, observed: "no close observed" };
  return {
    pass: frame.seq < record.close.seq,
    observed: `frame #${frame.seq}, close #${record.close.seq} (code ${record.close.code})`,
  };
}

async function main() {
  const a = openSocket("A");
  await a.opened;
  authenticate(a);
  await awaitAuthOk(a);
  const token = authOk(a)[0].sessionToken;
  check(
    "A: room password → auth-ok with a session token",
    typeof token === "string" && token.length > 0,
    `token ${token ? "present" : "MISSING"}`,
  );

  const b = openSocket("B");
  await b.opened;
  authenticate(b);
  await b.waitFor("connection-closing or close", closedOrAnnounced);
  // The close normally follows the frame within a few ms; wait for it so its
  // code can be reported. Its absence is not swallowed: the ordering check
  // below reports "no close observed" and fails on its own.
  await b.waitFor("close", (r) => r.close !== null).catch(() => {});
  observedCodes.b = b.close?.code;
  const bClosing = closing(b);
  bTurnedAway = bClosing.length === 1 && bClosing[0].reason === "conflict";
  const bRejected = b.frames.find((f) => f.t === "auth-failed");
  check(
    "B: no token → connection-closing reason 'conflict'",
    bTurnedAway,
    `reasons ${JSON.stringify(bClosing.map((f) => f.reason))}` +
      (bRejected
        ? ` — auth-failed: "${bRejected.reason}" (the runner's budget, not the conflict gate)`
        : ""),
  );
  const bOrder = frameBeforeClose(b);
  check("B: the frame arrived BEFORE the close", bOrder.pass, bOrder.observed);
  check("B: zero auth-ok", authOk(b).length === 0, `${authOk(b).length} auth-ok`);
  check(
    "A: untouched by B",
    a.close === null && closing(a).length === 0,
    a.close ? `A closed ${a.close.code}` : "A open, no frame",
  );

  const c = openSocket("C");
  await c.opened;
  authenticate(c, token);
  await awaitAuthOk(c);
  check("C: A's token → auth-ok (takeover)", authOk(c).length === 1, `${authOk(c).length} auth-ok`);
  await a.waitFor("connection-closing or close", closedOrAnnounced);
  await a.waitFor("close", (r) => r.close !== null).catch(() => {});
  observedCodes.a = a.close?.code;
  const aClosing = closing(a);
  check(
    "A: connection-closing reason 'replaced'",
    aClosing.length === 1 && aClosing[0].reason === "replaced",
    `reasons ${JSON.stringify(aClosing.map((f) => f.reason))}`,
  );
  const aOrder = frameBeforeClose(a);
  check("A: the frame arrived BEFORE the close", aOrder.pass, aOrder.observed);
  check(
    "C: not told it is being replaced",
    closing(c).length === 0 && c.close === null,
    closing(c).length ? "C got a frame" : "C clean",
  );

  await closeCleanly(c);
}

/** A clean 1000 close, waited for (500 ms cap) so the server sees a normal leave. */
function closeCleanly(record) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 500);
    record.ws.addEventListener(
      "close",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    record.ws.close(1000, "done");
  });
}

function report(codes, abortedWith) {
  const width = results.length ? Math.max(...results.map((r) => r.name.length)) : 0;
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name.padEnd(width)}  ${r.observed}`);
  }
  const observed = [codes.b, codes.a].filter((code) => code !== undefined);
  const codesNote =
    observed.length === 0
      ? "no close observed"
      : observed.every((code) => code === 1005)
        ? "1005: a proxy strips server-sent codes — the frame is the only signal"
        : observed.some((code) => code === 1005)
          ? "mixed: one code stripped, one intact — two different paths to the server?"
          : "server codes arrive intact: direct connection";
  console.log(
    `\nClose codes observed: B=${codes.b ?? "none"} A=${codes.a ?? "none"}  (${codesNote})`,
  );
  if (results.length > 0) {
    const table = roomId ? `table "${roomId}"` : "the server's default table";
    console.log(
      `Residue: ${table} keeps a live-check player, character and token for uid ${uid} until its idle clear or a DM removes them.` +
        (bTurnedAway ? " B's turned-away claim cost the runner's network 1 auth-work token." : ""),
    );
  }
  const failed = results.filter((r) => !r.pass).length;
  const neverRan = CHECK_NAMES.filter((name) => !results.some((r) => r.name === name));
  const ok = !abortedWith && failed === 0 && neverRan.length === 0;
  const total = CHECK_NAMES.length;
  console.log(
    ok
      ? `\nALL PASS (${total}/${total})`
      : `\nFAIL: ${failed} failed, ${neverRan.length} of ${total} never ran${abortedWith ? ` (aborted: ${abortedWith})` : ""}` +
          (neverRan.length ? `\n  never ran: ${neverRan.join(" | ")}` : ""),
  );
  process.exit(ok ? 0 : 1);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      console.error(`unexpected argument "${arg}" (expected --name value or --name=value)`);
      process.exit(2);
    }
    const eq = arg.indexOf("=");
    if (eq !== -1) {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      console.error(`--${key} needs a value (one that starts with -- goes as --${key}=value)`);
      process.exit(2);
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

main().then(
  () => report(observedCodes),
  (error) => {
    console.error(`ERROR: ${error.message}`);
    report(observedCodes, error.message || "unknown error");
  },
);
