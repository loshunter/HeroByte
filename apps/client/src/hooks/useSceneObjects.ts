// ============================================================================
// USE SCENE OBJECTS HOOK
// ============================================================================
// Derives a unified scene graph from the latest room snapshot. Falls back to
// legacy tokens/drawings/map if the server has not yet populated sceneObjects.

import { useMemo } from "react";
import type { RoomSnapshot, SceneObject } from "@shared";

const DEFAULT_TRANSFORM = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };

function cloneTransform(transform = DEFAULT_TRANSFORM) {
  return {
    x: transform.x ?? DEFAULT_TRANSFORM.x,
    y: transform.y ?? DEFAULT_TRANSFORM.y,
    scaleX: transform.scaleX ?? DEFAULT_TRANSFORM.scaleX,
    scaleY: transform.scaleY ?? DEFAULT_TRANSFORM.scaleY,
    rotation: transform.rotation ?? DEFAULT_TRANSFORM.rotation,
  };
}

function buildLegacySceneObjects(snapshot: RoomSnapshot): SceneObject[] {
  const objects: SceneObject[] = [];

  if (snapshot.mapBackground) {
    objects.push({
      id: "map",
      type: "map",
      owner: null,
      locked: true,
      zIndex: -100,
      transform: cloneTransform(),
      data: {
        imageUrl: snapshot.mapBackground,
      },
    });
  }

  for (const token of snapshot.tokens || []) {
    objects.push({
      id: `token:${token.id}`,
      type: "token",
      owner: token.owner,
      locked: false,
      zIndex: 10,
      transform: {
        x: token.x,
        y: token.y,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
      },
      data: {
        color: token.color,
        imageUrl: token.imageUrl,
      },
    });
  }

  for (const drawing of snapshot.drawings || []) {
    objects.push({
      id: `drawing:${drawing.id}`,
      type: "drawing",
      owner: drawing.owner ?? null,
      locked: false,
      zIndex: 5,
      transform: cloneTransform(),
      data: { drawing },
    });
  }

  if (snapshot.playerStagingZone) {
    const zone = snapshot.playerStagingZone;
    objects.push({
      id: "staging-zone",
      type: "staging-zone",
      owner: null,
      locked: true,
      zIndex: -80,
      transform: {
        x: zone.x,
        y: zone.y,
        scaleX: 1,
        scaleY: 1,
        rotation: zone.rotation ?? 0,
      },
      data: {
        width: zone.width,
        height: zone.height,
        rotation: zone.rotation ?? 0,
        label: "Player Staging Zone",
      },
    });
  }

  for (const pointer of snapshot.pointers || []) {
    const pointerKey = pointer.id ?? pointer.uid;
    objects.push({
      id: `pointer:${pointerKey}`,
      type: "pointer",
      owner: pointer.uid,
      locked: true,
      zIndex: 20,
      transform: {
        x: pointer.x,
        y: pointer.y,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
      },
      data: { uid: pointer.uid, pointerId: pointerKey, name: pointer.name },
    });
  }

  return objects;
}

export function useSceneObjects(snapshot: RoomSnapshot | null): SceneObject[] {
  return useMemo(() => {
    if (!snapshot) {
      return [];
    }

    if (snapshot.sceneObjects && snapshot.sceneObjects.length > 0) {
      return snapshot.sceneObjects.map((object) => ({
        ...object,
        transform: cloneTransform(object.transform),
      }));
    }

    return buildLegacySceneObjects(snapshot);
  }, [snapshot]);
}
