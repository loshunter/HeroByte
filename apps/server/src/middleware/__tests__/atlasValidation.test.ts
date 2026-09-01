// ============================================================================
// ATLAS VALIDATORS — through the real validateMessage pipeline
// ============================================================================
// Validator coverage lives at the middleware layer on purpose: route() runs
// AFTER validation, so a router-level test proves nothing about these rules
// (the trap that has cost three slices a debugging detour).

import { describe, expect, it } from "vitest";
import { validateMessage } from "../validation.js";

const NODE = { id: "node-1", kind: "dungeon", name: "The Undervault" };
const LINK = {
  id: "link-1",
  fromNodeId: "node-1",
  toNodeId: "node-2",
  anchor: { x: 100, y: 200 },
  linkType: "door",
  visibleToPlayers: true,
};

describe("atlas message validators", () => {
  it("accepts every atlas CRUD variation", () => {
    const valid = [
      { t: "atlas-create-node", node: NODE },
      { t: "atlas-create-node", node: { ...NODE, parentId: "root" } },
      { t: "atlas-update-node", nodeId: "node-1", patch: {} },
      { t: "atlas-update-node", nodeId: "node-1", patch: { name: "Renamed" } },
      { t: "atlas-update-node", nodeId: "node-1", patch: { discovered: true } },
      { t: "atlas-update-node", nodeId: "node-1", patch: { parentId: "root" } },
      { t: "atlas-update-node", nodeId: "node-1", patch: { parentId: null } },
      { t: "atlas-delete-node", nodeId: "node-1" },
      { t: "atlas-link-map", nodeId: "node-1", documentId: "doc-1" },
      { t: "atlas-create-link", link: LINK },
      { t: "atlas-delete-link", linkId: "link-1" },
    ];
    for (const message of valid) {
      const result = validateMessage(message as never);
      expect(result.valid, `${message.t}: ${result.valid ? "" : result.error}`).toBe(true);
    }
  });

  it("tolerates the ack layer's top-level commandId stamp (top level is NOT strict)", () => {
    const result = validateMessage({
      t: "atlas-create-node",
      node: NODE,
      commandId: "cmd-1",
    } as never);
    expect(result.valid).toBe(true);
  });

  it("rejects unknown keys inside nested objects (nested IS strict)", () => {
    for (const message of [
      { t: "atlas-create-node", node: { ...NODE, smuggled: true } },
      { t: "atlas-update-node", nodeId: "node-1", patch: { smuggled: true } },
      { t: "atlas-create-link", link: { ...LINK, smuggled: true } },
      { t: "atlas-create-link", link: { ...LINK, anchor: { x: 1, y: 2, z: 3 } } },
    ]) {
      expect(validateMessage(message as never).valid).toBe(false);
    }
  });

  it("rejects malformed payloads", () => {
    const invalid = [
      { t: "atlas-create-node", node: { ...NODE, kind: "moon-base" } },
      { t: "atlas-create-node", node: { ...NODE, name: "" } },
      { t: "atlas-create-node", node: { ...NODE, name: "x".repeat(65) } },
      { t: "atlas-create-node", node: { ...NODE, id: "" } },
      { t: "atlas-update-node", nodeId: "", patch: {} },
      { t: "atlas-update-node", nodeId: "node-1", patch: { discovered: "yes" } },
      { t: "atlas-delete-node" },
      { t: "atlas-link-map", nodeId: "node-1" },
      { t: "atlas-create-link", link: { ...LINK, linkType: "portal" } },
      { t: "atlas-create-link", link: { ...LINK, anchor: { x: Number.NaN, y: 0 } } },
      { t: "atlas-create-link", link: { ...LINK, anchor: { x: 2_000_000, y: 0 } } },
      { t: "atlas-create-link", link: { ...LINK, visibleToPlayers: "yes" } },
      { t: "atlas-delete-link", linkId: 7 },
    ];
    for (const message of invalid) {
      const result = validateMessage(message as never);
      expect(result.valid, `${message.t} should have been rejected`).toBe(false);
    }
  });
});
