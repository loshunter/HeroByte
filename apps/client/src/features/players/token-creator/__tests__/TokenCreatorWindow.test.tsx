/**
 * The creator window end to end under jsdom, with the canvas, the image
 * decoder and the upload injected. What this pins: Accept is the only step
 * that uploads; Cancel, ✕ and Escape change nothing; an upload refusal leaves
 * the token alone and says why; a link that cannot be baked is offered as is;
 * a pasted or dropped picture loads like a picked one.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssetUploadError } from "../../../map-studio/uploads/assetUpload";
import type { BakeCanvas } from "../bake";
import { TokenCreatorWindow } from "../TokenCreatorWindow";
import type { TokenCreatorDeps } from "../useTokenCreator";

const HASH = "b".repeat(64);
const decoded = { naturalWidth: 300, naturalHeight: 600 } as HTMLImageElement;

function fakeCanvas(type = "image/webp"): BakeCanvas {
  const noop = () => {};
  return {
    width: 0,
    height: 0,
    getContext: () => ({
      fillStyle: "",
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
      fillRect: noop,
      createLinearGradient: () => ({ addColorStop: noop }) as unknown as CanvasGradient,
      save: noop,
      restore: noop,
      translate: noop,
      scale: noop,
      rotate: noop,
      drawImage: noop,
    }),
    toBlob: (callback) => callback(new Blob(["baked"], { type })),
  };
}

function deps(overrides: Partial<TokenCreatorDeps> = {}): TokenCreatorDeps {
  return {
    load: {
      createObjectURL: vi.fn(() => "blob:picked"),
      revokeObjectURL: vi.fn(),
      loadImage: vi.fn(async () => decoded),
      readableSource: vi.fn(async (url: string) => url),
      normalizeLink: vi.fn(async (url: string) => url),
    },
    bake: { createCanvas: () => fakeCanvas() },
    upload: vi.fn(async () => ({
      hash: HASH,
      url: `/assets/${HASH}`,
      mime: "image/webp",
      size: 5,
      deduplicated: false,
    })),
    getCredentials: () => ({ secret: "s" }),
    autoColor: () => "#334455",
    ...overrides,
  };
}

function open(d = deps()) {
  const onApply = vi.fn();
  const onClose = vi.fn();
  render(
    <TokenCreatorWindow
      name="Eldryn"
      tokenSize="huge"
      onApply={onApply}
      onClose={onClose}
      deps={d}
    />,
  );
  return { onApply, onClose, d };
}

/** Let any bake and upload a click started run to the end. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function pickFile(type = "image/png") {
  const input = screen.getByLabelText("Token picture file");
  fireEvent.change(input, { target: { files: [new File(["x"], "art.png", { type })] } });
  await screen.findByRole("button", { name: /Rotate/ });
}

describe("TokenCreatorWindow", () => {
  it("opens with one Picture tab, titled for its token", () => {
    open();
    expect(screen.getByText("🖼️ Token picture: Eldryn")).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Picture"]);
  });

  it("Accept bakes, uploads a WebP, sets the picture and closes", async () => {
    const { onApply, onClose, d } = open();
    await pickFile();
    fireEvent.click(screen.getByRole("button", { name: "Use this picture" }));
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    const [file] = vi.mocked(d.upload).mock.calls[0]!;
    expect(file.type).toBe("image/webp");
    expect(file.name).toBe("token.webp");
    expect(onApply.mock.calls[0]![0]).toMatch(new RegExp(`/assets/${HASH}$`));
    expect(onClose).toHaveBeenCalled();
  });

  it("an engine that answers PNG uploads a PNG", async () => {
    const d = deps({ bake: { createCanvas: () => fakeCanvas("image/png") } });
    open(d);
    await pickFile();
    fireEvent.click(screen.getByRole("button", { name: "Use this picture" }));
    await waitFor(() => expect(d.upload).toHaveBeenCalled());
    expect(vi.mocked(d.upload).mock.calls[0]![0].type).toBe("image/png");
  });

  it("Accept does nothing before a picture is chosen", () => {
    const { onApply, d } = open();
    fireEvent.click(screen.getByRole("button", { name: "Use this picture" }));
    expect(d.upload).not.toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("Cancel uploads nothing and changes nothing", async () => {
    const { onApply, onClose, d } = open();
    await pickFile();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    await settle();
    expect(d.upload).not.toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("Escape closes like Cancel", async () => {
    const { onApply, onClose, d } = open();
    await pickFile();
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    await settle();
    expect(d.upload).not.toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("a full table store says so and leaves the token as it was", async () => {
    const d = deps({
      upload: vi.fn(async () => {
        throw new AssetUploadError("quota-exceeded", "The table's asset storage is full.");
      }),
    });
    const { onApply, onClose } = open(d);
    await pickFile();
    fireEvent.click(screen.getByRole("button", { name: "Use this picture" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The table's asset storage is full.",
    );
    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("a link that cannot be read is offered as is, and sets exactly that link", async () => {
    const d = deps();
    vi.mocked(d.load.loadImage).mockRejectedValue(new Error("no CORS"));
    const { onApply, onClose } = open(d);
    const link = "https://media.discordapp.net/attachments/1/2/art.png";
    fireEvent.change(screen.getByLabelText("Or a link to a picture"), { target: { value: link } });
    fireEvent.click(screen.getByRole("button", { name: "Load link" }));
    const offer = await screen.findByRole("button", { name: "Use the link as is" });
    // Nothing loaded at all: the words say so, rather than blaming the site.
    expect(screen.getByText(/did not load a picture: check the address/)).toBeInTheDocument();
    fireEvent.click(offer);
    expect(onApply).toHaveBeenCalledWith(link);
    expect(onClose).toHaveBeenCalled();
    expect(d.upload).not.toHaveBeenCalled();
  });

  it("a link whose canvas taints at the bake is offered as is", async () => {
    const tainted = fakeCanvas();
    tainted.toBlob = () => {
      throw Object.assign(new Error("tainted"), { name: "SecurityError" });
    };
    const d = deps({ bake: { createCanvas: () => tainted } });
    const { onApply } = open(d);
    fireEvent.change(screen.getByLabelText("Or a link to a picture"), {
      target: { value: "https://example.com/a.png" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load link" }));
    await screen.findByRole("button", { name: /Rotate/ });
    fireEvent.click(screen.getByRole("button", { name: "Use this picture" }));
    const offer = await screen.findByRole("button", { name: "Use the link as is" });
    expect(screen.getByText(/does not let HeroByte copy its pictures/)).toBeInTheDocument();
    fireEvent.click(offer);
    expect(onApply).toHaveBeenCalledWith("https://example.com/a.png");
    expect(d.upload).not.toHaveBeenCalled();
  });

  it("a pasted image loads like a picked file", async () => {
    const { d } = open();
    const shot = new File(["x"], "shot.png", { type: "image/png" });
    const paste = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(paste, "clipboardData", {
      value: { files: { length: 1, item: () => shot }, items: null, getData: () => "" },
    });
    act(() => {
      document.dispatchEvent(paste);
    });
    await screen.findByRole("button", { name: /Rotate/ });
    expect(d.load.createObjectURL).toHaveBeenCalledWith(shot);
    expect(paste.defaultPrevented).toBe(true);
  });

  it("a dropped file loads like a picked file", async () => {
    const { d } = open();
    const dropped = new File(["x"], "drop.webp", { type: "image/webp" });
    fireEvent.drop(screen.getByTestId("token-creator-crop"), {
      dataTransfer: { files: { length: 1, item: () => dropped }, getData: () => "" },
    });
    await screen.findByRole("button", { name: /Rotate/ });
    expect(d.load.createObjectURL).toHaveBeenCalledWith(dropped);
  });

  it("arrow keys move the picture, not a token behind the window", async () => {
    open();
    await pickFile();
    const crop = screen.getByTestId("token-creator-crop");
    const before = crop.querySelector("img")!.style.left;
    // A covering 1:2 portrait has no sideways slack, so nudge it up and down.
    const event = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      crop.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(crop.querySelector("img")!.style.left).toBe(before);
    // Down by one nudge (0.02 of the square): from −50% to −48%.
    expect(crop.querySelector("img")!.style.top).toBe("-48%");
  });

  it("marks the page modal while open, so WASD stays off the map", () => {
    open();
    expect(document.querySelector("[data-modal-overlay]")).not.toBeNull();
  });
});
