// ============================================================================
// TOKEN CREATOR — STATE AND ACTIONS
// ============================================================================
// One picture at a time: load it (file, drop, paste, link), frame it, accept.
// Accept is the ONLY step that uploads, so a cancelled creator leaves nothing
// on the table's store. Accept writes through the caller's `onApply(url)`,
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
  type LoadDeps,
  type LoadedPicture,
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
  /** A link that loads but cannot be baked: offered as is. */
  const [unbakeable, setUnbakeable] = useState<string | null>(null);

  // Apply through the latest callback, never the one captured when a slow
  // upload began (an NPC's onApply closes over its other fields).
  const applyRef = useRef({ onApply, onDone });
  useEffect(() => {
    applyRef.current = { onApply, onDone };
  });
  // The picture shown now, so a stale load cannot replace a newer one.
  const loadSeq = useRef(0);
  const pictureRef = useRef<LoadedPicture | null>(null);
  useEffect(() => () => pictureRef.current?.release(), []);

  const adopt = useCallback(
    (next: LoadedPicture) => {
      pictureRef.current?.release();
      pictureRef.current = next;
      setPicture(next);
      setCrop(DEFAULT_CROP);
      setAutoColor(deps.autoColor(next));
    },
    [deps],
  );

  const load = useCallback(
    async (start: () => Promise<LoadedPicture>) => {
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
        if (failure instanceof UnbakeableLinkError) setUnbakeable(failure.link);
        else setError(failure instanceof Error ? failure.message : "That picture would not load.");
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

  const accept = useCallback(async () => {
    if (!picture || phase !== "idle") return;
    setError(null);
    setPhase("baking");
    try {
      const fill = resolveBackdrop(backdrop, autoColor);
      const edge = bakeEdgeFor(tokenSize);
      const baked = await bakePicture(picture.image, picture.size, crop, fill, edge, deps.bake);
      setPhase("uploading");
      const file = new File([baked.blob], baked.fileName, { type: baked.mime });
      const info = await deps.upload(file, deps.getCredentials());
      applyRef.current.onApply(uploadedAssetUrl(info.hash));
      applyRef.current.onDone();
    } catch (failure) {
      if (failure instanceof TaintedPictureError && picture.link) {
        setUnbakeable(picture.link);
      } else if (failure instanceof AssetUploadError) {
        setError(failure.message);
      } else {
        setError(failure instanceof Error ? failure.message : "The picture could not be saved.");
      }
    } finally {
      setPhase("idle");
    }
  }, [picture, phase, backdrop, autoColor, tokenSize, crop, deps]);

  /** Today's behaviour for a link that cannot be baked: set it exactly as given. */
  const applyLinkAsIs = useCallback(() => {
    if (!unbakeable) return;
    applyRef.current.onApply(unbakeable);
    applyRef.current.onDone();
  }, [unbakeable]);

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
    loadFile,
    loadLink,
    accept,
    applyLinkAsIs,
  };
}

export type TokenCreatorState = ReturnType<typeof useTokenCreator>;
