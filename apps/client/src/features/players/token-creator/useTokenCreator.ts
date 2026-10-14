// ============================================================================
// TOKEN CREATOR — STATE AND ACTIONS
// ============================================================================
// One picture at a time: load it (file, drop, paste, link), frame it, accept.
// Accept is the ONLY step that uploads. Closing the window (Cancel, ✕, Escape)
// abandons whatever is in flight: a bake not yet uploaded is never uploaded,
// and an upload that lands after the close is never applied. It is sent with
// the "apply" intent, so the server's reclaim sweep releases the table's claim
// on it once it has gone unreferenced for 15 minutes (APPLY_ADOPT_WINDOW_MS,
// apps/server/src/domains/assets/assetRoomClaims.ts). Accept writes
// through the caller's `onApply(url)`,
// the same callback the old URL field committed through, so a player's token
// and an NPC's record (which the server copies back onto its token) both keep
// the result.

import { useCallback, useEffect, useRef, useState } from "react";
import type { TokenSize } from "@herobyte/shared";
import {
  AssetUploadError,
  uploadAssetFile,
  uploadedAssetUrl,
  type AssetUploadCredentials,
} from "../../map-studio/uploads/assetUpload";
import { sessionCredentials } from "../../session/sessionBridge";
import { AUTO_FALLBACK, resolveBackdrop, type Backdrop } from "./backdrop";
import {
  TaintedPictureError,
  bakeEdgeFor,
  bakePicture,
  browserBakeDeps,
  type BakeDeps,
} from "./bake";
import { DEFAULT_CROP, type CropState } from "./cropMath";
import {
  UnbakeableLinkError,
  browserLoadDeps,
  loadPictureFile,
  loadPictureLink,
  sampleAutoColor,
  pictureFileFrom,
  pictureLinkFrom,
  type LoadDeps,
  type LoadedPicture,
  type TransferLike,
  type UnbakeableReason,
} from "./pictureSources";

export interface TokenCreatorDeps {
  load: LoadDeps;
  bake: BakeDeps;
  upload: typeof uploadAssetFile;
  getCredentials: () => AssetUploadCredentials | null;
  autoColor: (picture: LoadedPicture) => string;
}

export const browserCreatorDeps: TokenCreatorDeps = {
  load: browserLoadDeps,
  bake: browserBakeDeps,
  upload: uploadAssetFile,
  getCredentials: sessionCredentials,
  autoColor: sampleAutoColor,
};

export interface TokenCreatorOptions {
  tokenSize?: TokenSize;
  onApply: (url: string) => void;
  onDone: () => void;
  deps?: TokenCreatorDeps;
}

export type CreatorPhase = "idle" | "loading" | "baking" | "uploading";

/** The server refuses a token image link longer than this (tokenValidators). */
export const LINK_MAX_LENGTH = 2048;

export function useTokenCreator({
  tokenSize,
  onApply,
  onDone,
  deps = browserCreatorDeps,
}: TokenCreatorOptions) {
  const [picture, setPicture] = useState<LoadedPicture | null>(null);
  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP);
  const [backdrop, setBackdrop] = useState<Backdrop>({ kind: "auto" });
  const [autoColor, setAutoColor] = useState(AUTO_FALLBACK);
  const [phase, setPhase] = useState<CreatorPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  /** A link that cannot be baked (or whose copy could not be saved): offered as is. */
  const [unbakeable, setUnbakeable] = useState<{ link: string; reason: UnbakeableReason } | null>(
    null,
  );

  // Apply through the latest callback, never the one captured when a slow
  // upload began (an NPC's onApply closes over its other fields).
  const applyRef = useRef({ onApply, onDone });
  useEffect(() => {
    applyRef.current = { onApply, onDone };
  });
  // The picture shown now, so a stale load cannot replace a newer one.
  const loadSeq = useRef(0);
  const pictureRef = useRef<LoadedPicture | null>(null);
  // Closed: every await from here on drops its result (a load in flight
  // releases what it loaded; a bake or upload is never applied).
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      loadSeq.current += 1;
      pictureRef.current?.release();
      pictureRef.current = null;
    };
  }, []);
  // A save in progress owns the picture: nothing new loads over it.
  const saving = useRef(false);
  // The load the link field was last edited during: a failure it ends in is
  // about a link no longer typed, so it offers nothing.
  const editedDuring = useRef(-1);

  const adopt = useCallback(
    (next: LoadedPicture) => {
      pictureRef.current?.release();
      pictureRef.current = next;
      setPicture(next);
      setError(null);
      setCrop(DEFAULT_CROP);
      setAutoColor(deps.autoColor(next));
    },
    [deps],
  );

  const load = useCallback(
    async (start: () => Promise<LoadedPicture>) => {
      if (saving.current) return;
      const seq = ++loadSeq.current;
      setPhase("loading");
      setError(null);
      setUnbakeable(null);
      try {
        const next = await start();
        if (seq !== loadSeq.current) return next.release();
        adopt(next);
      } catch (failure) {
        if (seq !== loadSeq.current) return;
        if (failure instanceof UnbakeableLinkError) {
          // The old picture goes: Accept and "as is" now mean this link only.
          pictureRef.current?.release();
          pictureRef.current = null;
          setPicture(null);
          if (editedDuring.current !== seq) {
            setUnbakeable({ link: failure.link, reason: failure.reason });
          }
        } else
          setError(failure instanceof Error ? failure.message : "That picture would not load.");
      } finally {
        if (seq === loadSeq.current) setPhase("idle");
      }
    },
    [adopt],
  );

  const loadFile = useCallback(
    (file: File) => load(() => loadPictureFile(file, deps.load)),
    [load, deps],
  );
  const loadLink = useCallback(
    (link: string) => {
      if (!link.trim()) return Promise.resolve();
      return load(() => loadPictureLink(link, deps.load));
    },
    [load, deps],
  );

  /** A drop: its picture file, else its link; anything else says what to drop. */
  const loadDropped = useCallback(
    (transfer: TransferLike | null) => {
      const file = pictureFileFrom(transfer);
      if (file) return void loadFile(file);
      const link = pictureLinkFrom(transfer);
      if (link) return void loadLink(link);
      if (!saving.current) setError("Drop a picture file, or a link to a picture.");
    },
    [loadFile, loadLink],
  );

  const accept = useCallback(async () => {
    if (!picture || phase !== "idle" || saving.current) return;
    saving.current = true;
    setError(null);
    setPhase("baking");
    try {
      const fill = resolveBackdrop(backdrop, autoColor);
      const edge = bakeEdgeFor(tokenSize);
      const baked = await bakePicture(picture.image, picture.size, crop, fill, edge, deps.bake);
      if (!alive.current) return;
      setPhase("uploading");
      const file = new File([baked.blob], baked.fileName, { type: baked.mime });
      const info = await deps.upload(file, deps.getCredentials(), undefined, { intent: "apply" });
      if (!alive.current) return;
      applyRef.current.onApply(uploadedAssetUrl(info.hash));
      applyRef.current.onDone();
    } catch (failure) {
      if (!alive.current) return;
      if (failure instanceof TaintedPictureError && picture.link) {
        setUnbakeable({ link: picture.link, reason: "no-copy" });
      } else if (failure instanceof AssetUploadError) {
        setError(failure.message);
      } else {
        setError(failure instanceof Error ? failure.message : "The picture could not be saved.");
      }
    } finally {
      saving.current = false;
      if (alive.current) setPhase("idle");
    }
  }, [picture, phase, backdrop, autoColor, tokenSize, crop, deps]);

  /**
   * Today's behaviour, always on offer for a link: set it exactly as given,
   * unframed and with no copy on the table. The picture's link when it loaded,
   * or the link that could not be loaded.
   */
  const linkAsIs = phase === "idle" ? (unbakeable?.link ?? picture?.link ?? null) : null;
  const applyLinkAsIs = useCallback(() => {
    if (!linkAsIs || saving.current) return;
    if (linkAsIs.length > LINK_MAX_LENGTH) {
      setError(`That link is too long to use (over ${LINK_MAX_LENGTH} characters).`);
      return;
    }
    applyRef.current.onApply(linkAsIs);
    applyRef.current.onDone();
  }, [linkAsIs]);

  /** The link field changed: a failed link's offer no longer matches what is typed. */
  const forgetFailedLink = useCallback(() => {
    editedDuring.current = loadSeq.current;
    setUnbakeable(null);
    setError(null);
  }, []);

  return {
    picture,
    crop,
    setCrop,
    backdrop,
    setBackdrop,
    autoColor,
    phase,
    error,
    unbakeable,
    linkAsIs,
    forgetFailedLink,
    loadFile,
    loadLink,
    loadDropped,
    accept,
    applyLinkAsIs,
  };
}

export type TokenCreatorState = ReturnType<typeof useTokenCreator>;
