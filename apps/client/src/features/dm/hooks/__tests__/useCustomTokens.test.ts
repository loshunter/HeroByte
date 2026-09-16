/**
 * useCustomTokens: the shelf is read off the snapshot, and the two messages
 * that change it carry exactly the wire shape — no description key when
 * there is none, so the validator's optional stays optional. An add runs the
 * image pipeline first, so the thumbnail it made (or did not) is what rides
 * the message.
 */

import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { RoomSnapshot } from "@herobyte/shared";
import { CUSTOM_TOKEN_LIMITS } from "@herobyte/shared";
import { useCustomTokens } from "../useCustomTokens";
import type { PreparedCustomImage } from "../../token-library/customTokenImages";

/** The pipeline is proved in its own suite; here it is a stand-in. */
const passthrough = (imageUrl: string) =>
  Promise.resolve<PreparedCustomImage>({ imageUrl, mirrored: false });

const token = {
  id: "ct-1",
  name: "Old Marta",
  imageUrl: "https://i.imgur.com/x.png",
  tags: ["npc", "villager"],
  size: "medium",
  addedBy: "dm",
  addedAt: 1,
};

const draft = {
  name: "Old Marta",
  imageUrl: "https://i.imgur.com/x.png",
  tags: [] as string[],
  size: "medium" as const,
};

/**
 * A hook wired to a shelf that behaves like the server: an accepted add seats
 * the token the message described, which is the signal the hook waits on.
 * `accept: false` is every silent refusal — a validator rejection, the
 * 200-token cap, a revoked DM role, a dropped socket — which the wire reports
 * identically, i.e. not at all.
 *
 * The seated token carries the message's own name and imageUrl (trimmed, the
 * way CustomTokenService.add stores them) rather than a fixed stand-in,
 * because the hook now waits for ITS token and not for a longer list.
 */
function setup(options: { accept?: boolean; shelf?: unknown[]; prepareImage?: unknown } = {}) {
  const accept = options.accept !== false;
  const shelf = (options.shelf ?? []) as Record<string, unknown>[];
  const sendMessage = vi.fn((message: { t: string; name?: string; imageUrl?: string }) => {
    if (message.t === "add-custom-token" && accept)
      shelf.push({
        ...token,
        id: `ct-${shelf.length}`,
        name: message.name?.trim(),
        imageUrl: message.imageUrl?.trim(),
      });
  });
  const { result } = renderHook(() =>
    useCustomTokens({
      snapshot: { customTokens: shelf } as unknown as RoomSnapshot,
      sendMessage,
      prepareImage: (options.prepareImage ?? passthrough) as never,
      // Short, so the refusal path costs the suite 60ms rather than 5s.
      confirmTimeoutMs: 60,
    }),
  );
  return { result, sendMessage, shelf };
}

describe("useCustomTokens", () => {
  it("reads the shelf off the snapshot, and an absent one is an empty list", () => {
    const sendMessage = vi.fn();
    const withShelf = renderHook(() =>
      useCustomTokens({
        snapshot: { customTokens: [token] } as unknown as RoomSnapshot,
        sendMessage,
      }),
    );
    expect(withShelf.result.current.tokens).toEqual([token]);
    const without = renderHook(() =>
      useCustomTokens({ snapshot: {} as unknown as RoomSnapshot, sendMessage }),
    );
    expect(without.result.current.tokens).toEqual([]);
    const none = renderHook(() => useCustomTokens({ snapshot: null, sendMessage }));
    expect(none.result.current.tokens).toEqual([]);
  });

  it("addToken sends add-custom-token, with the description only when there is one", async () => {
    const { result, sendMessage } = setup();
    await result.current.addToken({
      name: "Old Marta",
      imageUrl: "https://i.imgur.com/x.png",
      tags: ["npc"],
      size: "small",
    });
    expect(sendMessage).toHaveBeenLastCalledWith({
      t: "add-custom-token",
      name: "Old Marta",
      imageUrl: "https://i.imgur.com/x.png",
      tags: ["npc"],
      size: "small",
    });
    await result.current.addToken({
      name: "Ogre",
      imageUrl: "https://x/o.png",
      description: "Big.",
      tags: [],
      size: "large",
    });
    expect(sendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ t: "add-custom-token", description: "Big.", size: "large" }),
    );
  });

  it("keeps a copy by default, and only when the caller says otherwise does not", async () => {
    const prepareImage = vi.fn(passthrough);
    const { result } = setup({ prepareImage });

    await result.current.addToken(draft);
    expect(prepareImage).toHaveBeenLastCalledWith(draft.imageUrl, { mirror: true });
    await result.current.addToken(draft, {});
    expect(prepareImage).toHaveBeenLastCalledWith(draft.imageUrl, { mirror: true });
    await result.current.addToken(draft, { mirror: false });
    expect(prepareImage).toHaveBeenLastCalledWith(draft.imageUrl, { mirror: false });
  });

  it("confirms a copy that was made — the one outcome the DM asked for by hand", async () => {
    const prepareImage = vi.fn(async () => ({
      imageUrl: `/assets/${"b".repeat(64)}`,
      thumbUrl: `/assets/${"c".repeat(64)}`,
      mirrored: true,
    }));
    const { result } = setup({ prepareImage });

    const copied = await result.current.addToken({
      name: "Old Marta",
      imageUrl: "https://i.imgur.com/x.png",
      tags: [],
      size: "medium",
    });
    expect(copied.note).toMatch(/copy .* is kept on this table/i);

    // BOTH facts when both happened. The confirmation used to be the `else`
    // of the pipeline's note, so a copy that succeeded while the thumbnail
    // failed answered the thumbnail and left the DM's own request unanswered.
    prepareImage.mockResolvedValueOnce({
      imageUrl: `/assets/${"d".repeat(64)}`,
      mirrored: true,
      note: "No thumbnail: that image could not be copied.",
    } as never);
    const half = await result.current.addToken({
      name: "Bandit",
      imageUrl: "https://i.imgur.com/y.png",
      tags: [],
      size: "medium",
    });
    expect(half.note).toBe(
      "A copy of that picture is kept on this table. No thumbnail: that image could not be copied.",
    );

    // And stays silent when there was nothing to copy.
    prepareImage.mockResolvedValueOnce({
      imageUrl: "/tokens/NPC/x.png",
      mirrored: false,
    } as never);
    const untouched = await result.current.addToken({
      name: "Goblin",
      imageUrl: "/tokens/NPC/x.png",
      tags: [],
      size: "medium",
    });
    expect(untouched).toEqual({ added: true });
  });

  it("sends what the pipeline produced, and hands its note back to the form", async () => {
    const prepareImage = vi.fn(async () => ({
      imageUrl: "https://i.imgur.com/x.png",
      mirrored: false,
      thumbUrl: `http://localhost:8788/assets/${"a".repeat(64)}`,
    }));
    const { result, sendMessage } = setup({ prepareImage });

    const withThumb = await result.current.addToken({
      name: "Old Marta",
      imageUrl: "https://i.imgur.com/x.png",
      tags: [],
      size: "medium",
    });
    expect(prepareImage).toHaveBeenCalledWith("https://i.imgur.com/x.png", { mirror: true });
    expect(sendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ thumbUrl: `http://localhost:8788/assets/${"a".repeat(64)}` }),
    );
    expect(withThumb).toEqual({ added: true });

    // No thumb: the key is ABSENT, not undefined — the validator's optional
    // stays optional, and the picker falls back to the full picture.
    prepareImage.mockResolvedValueOnce({
      imageUrl: "https://i.imgur.com/x.png",
      mirrored: false,
      note: "No thumbnail — that image could not be read.",
    } as never);
    const noThumb = await result.current.addToken({
      name: "Old Marta",
      imageUrl: "https://i.imgur.com/x.png",
      tags: [],
      size: "medium",
    });
    expect(Object.keys(sendMessage.mock.lastCall![0])).not.toContain("thumbUrl");
    expect(noThumb).toEqual({ added: true, note: "No thumbnail — that image could not be read." });
  });

  it("removeToken sends remove-custom-token", () => {
    const { result, sendMessage } = setup();
    result.current.removeToken("ct-1");
    expect(sendMessage).toHaveBeenCalledWith({ t: "remove-custom-token", id: "ct-1" });
  });

  it("sees the shelf grow the way the WIRE grows it: a new array on a new snapshot", async () => {
    // The helper above mutates one array in place, which no real snapshot ever
    // does — `snapshot.customTokens` is freshly deserialized per broadcast. If
    // the watcher could only see in-place growth it would time out on every
    // successful add in production while every unit test stayed green. This is
    // the test that would have caught that.
    let shelf: unknown[] = [];
    const sendMessage = vi.fn();
    const { result, rerender } = renderHook(() =>
      useCustomTokens({
        snapshot: { customTokens: shelf } as unknown as RoomSnapshot,
        sendMessage,
        prepareImage: passthrough as never,
        confirmTimeoutMs: 2000,
      }),
    );

    const pending = result.current.addToken(draft);
    // The server answers: a whole new snapshot, holding a DIFFERENT array.
    shelf = [token];
    rerender();

    await expect(pending).resolves.toEqual({ added: true });
  });

  it("waits for MY token, not for a longer shelf — a co-DM's add is not my success", async () => {
    // The shelf is shared table state and co-DM is a supported role. Counting
    // asks "is it longer than it was", which a co-DM answers for me: my add is
    // refused, theirs lands in the same window, and the form calls reset() —
    // wiping the name, blurb, tags and stance over a token that does not exist.
    let shelf: unknown[] = [];
    const sendMessage = vi.fn();
    const { result, rerender } = renderHook(() =>
      useCustomTokens({
        snapshot: { customTokens: shelf } as unknown as RoomSnapshot,
        sendMessage,
        prepareImage: passthrough as never,
        confirmTimeoutMs: 200,
      }),
    );

    const pending = result.current.addToken(draft);
    // Someone else's token lands. Mine never does.
    shelf = [{ ...token, id: "ct-theirs", name: "Bandit Chief" }];
    rerender();

    await expect(pending).resolves.toEqual(
      expect.objectContaining({ added: false, note: expect.stringMatching(/did not take/i) }),
    );
  });

  it("a co-DM's REMOVAL does not turn my successful add into a failure", async () => {
    // The other direction of the same count: they remove one while my two
    // uploads run, so the total is flat and a token that DID land reads as
    // refused. The DM retries — a duplicate token and two more uploads.
    let shelf: unknown[] = [
      { ...token, id: "ct-theirs-1", name: "Bandit Chief" },
      { ...token, id: "ct-theirs-2", name: "Bandit Guard" },
    ];
    const sendMessage = vi.fn();
    const { result, rerender } = renderHook(() =>
      useCustomTokens({
        snapshot: { customTokens: shelf } as unknown as RoomSnapshot,
        sendMessage,
        prepareImage: passthrough as never,
        confirmTimeoutMs: 2000,
      }),
    );

    const pending = result.current.addToken(draft);
    // Mine arrives; one of theirs leaves. Same length as before.
    shelf = [
      { ...token, id: "ct-theirs-1", name: "Bandit Chief" },
      { ...token, id: "ct-mine", name: draft.name, imageUrl: draft.imageUrl },
    ];
    rerender();

    await expect(pending).resolves.toEqual({ added: true });
  });

  it("says so when the table does not take the token, instead of looking like a success", async () => {
    // Every refusal reaches the client the same way: not at all. The add is
    // fire-and-forget with no commandId, a validator rejection is a
    // server-side log, and the cap refusal is a console.warn — so an add that
    // vanished used to render exactly like one that worked.
    const { result, sendMessage } = setup({ accept: false });

    const refused = await result.current.addToken(draft);
    expect(sendMessage).toHaveBeenCalled();
    // `added` is the flag, not the note: it is the one thing that decides
    // whether the DM keeps the name, blurb, tags and stance they just typed,
    // and asserting only the wording left it free to be true on every refusal.
    expect(refused).toEqual({
      added: false,
      note: expect.stringMatching(/did not take that token/i),
    });
  });

  it("refuses an address the wire would drop BEFORE it spends two uploads on it", async () => {
    const prepareImage = vi.fn(passthrough);
    const { result, sendMessage } = setup({ prepareImage });

    for (const imageUrl of [
      "goblin.png",
      "http://example.com/x.png",
      "data:image/png;base64,AA",
      // The /assets/<sha256> tail at somebody ELSE'S host. The shared rule
      // admits that shape at any origin — the server has to, since it cannot
      // know its own public one — so without the client passing its asset
      // origin this cleared the pre-check and then drew nothing at the table,
      // blocked as mixed content on the https host.
      `http://attacker.example/assets/${"a".repeat(64)}`,
    ]) {
      const result_ = await result.current.addToken({ ...draft, imageUrl });
      expect(result_, imageUrl).toEqual({
        added: false,
        note: expect.stringMatching(/cannot be used/i),
      });
    }
    // Not one upload rendered, not one message sent.
    expect(prepareImage).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();

    // …and THIS table's own upload, over plain http, still goes through. A
    // LITERAL origin: this used to be built from ownAssetOrigin(), the same
    // oracle the hook consults, so it was `x.startsWith(x)` for any x and a
    // wrong origin (every ⬆ UPLOAD refused on a non-TLS table) left 228 tests
    // green. jsdom's WS_URL is ws://localhost:8787; ownAssetOrigin is pinned
    // to that literal in assetUpload.test.ts.
    const ours = `http://localhost:8787/assets/${"b".repeat(64)}`;
    expect(await result.current.addToken({ ...draft, imageUrl: ours })).toEqual({ added: true });
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: ours }));
  });

  it("waits for the name the SERVICE stored, which is trimmed, not the one it sent", async () => {
    // The form sends name.trim().slice(0, 50): a 62-character name truncates
    // to 50 and can END on a space. The hook sends that raw; the service
    // stores it trimmed; the watcher has to match the stored spelling or the
    // DM is told "the table did not take that token" over one that landed —
    // then retries and duplicates it. Both .trim()s in the hook could be
    // deleted with every test green until this one.
    const { result, sendMessage } = setup();
    // Built, not hand-counted — the first draft of this line was 49.
    const raw = `${"Old Marta the innkeeper of the Salted Herring".padEnd(49, "!")} `;
    expect(raw).toHaveLength(50);
    expect(raw.endsWith(" ")).toBe(true);
    await expect(result.current.addToken({ ...draft, name: raw })).resolves.toEqual({
      added: true,
    });
    // Raw on the wire…
    expect(sendMessage).toHaveBeenLastCalledWith(expect.objectContaining({ name: raw }));
  });

  it("stops waiting when the hook unmounts — DM de-elevation, not the menu closing", async () => {
    // The wait is a 50ms setTimeout chain against a ref. After unmount that
    // ref can never change again, so without the guard the chain ran on to
    // the full deadline holding the whole add's closure.
    //
    // NOT "when the menu closes": this hook lives in DMMenuContainer, which
    // FloatingPanelsLayout mounts under `{isDM && …}`, ABOVE DMMenu's own
    // `{open && …}` gate. Closing the menu unmounts the tabs and the form and
    // leaves this hook running, so an add in flight still confirms. The
    // guard fires on DM de-elevation, a lazy-chunk failure, or app teardown.
    // b603b533's message and this test's first name both said "closed the
    // menu"; a later refactor that moves the hook under the open gate would
    // make every close-mid-add report "did not take that token" over a token
    // that landed, and this test would have called that correct.
    const shelf: unknown[] = [];
    const sendMessage = vi.fn();
    const { result, unmount } = renderHook(() =>
      useCustomTokens({
        snapshot: { customTokens: shelf } as unknown as RoomSnapshot,
        sendMessage,
        prepareImage: passthrough as never,
        // Long enough that only the unmount can end this inside the timeout.
        confirmTimeoutMs: 30_000,
      }),
    );

    const pending = result.current.addToken(draft);
    await Promise.resolve();
    unmount();

    await expect(pending).resolves.toEqual(
      expect.objectContaining({ added: false, note: expect.stringMatching(/did not take/i) }),
    );
  });

  it("refuses an over-long address before the uploads, the way the wire does", async () => {
    // The wire tests LENGTH first and the shape second, and a presigned CDN
    // link runs well past 2048 characters while passing the shape test
    // perfectly — so without this the shape check waves it through and two
    // uploads are spent on an address the validator will drop.
    const prepareImage = vi.fn(passthrough);
    const { result, sendMessage } = setup({ prepareImage });

    const tooLong = `https://cdn.example.com/${"a".repeat(CUSTOM_TOKEN_LIMITS.URL_MAX)}.png`;
    const refused = await result.current.addToken({ ...draft, imageUrl: tooLong });
    expect(refused.added).toBe(false);
    expect(refused.note).toContain(String(CUSTOM_TOKEN_LIMITS.URL_MAX));
    expect(prepareImage).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("sends the address the guards cleared — trimmed, the way the wire reads it", async () => {
    // The guards trim; the validator does not. So a pasted link with a stray
    // space cleared the pre-check, was sent raw, and the wire refused it on
    // the shape test — two uploads spent and the token never seated.
    const prepareImage = vi.fn(passthrough);
    const { result, sendMessage } = setup({ prepareImage });

    const added = await result.current.addToken({
      ...draft,
      imageUrl: "  https://i.imgur.com/x.png  ",
    });
    expect(prepareImage).toHaveBeenCalledWith("https://i.imgur.com/x.png", { mirror: true });
    expect(sendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ imageUrl: "https://i.imgur.com/x.png" }),
    );
    expect(added).toEqual({ added: true });
  });

  it("refuses at the cap, before the uploads, and names the number", async () => {
    const full = Array.from({ length: CUSTOM_TOKEN_LIMITS.COUNT_MAX }, (_, i) => ({
      ...token,
      id: `ct-${i}`,
    }));
    const prepareImage = vi.fn(passthrough);
    const { result, sendMessage } = setup({ shelf: full, prepareImage });

    const refused = await result.current.addToken(draft);
    expect(refused.added).toBe(false);
    expect(refused.note).toContain(String(CUSTOM_TOKEN_LIMITS.COUNT_MAX));
    expect(prepareImage).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
