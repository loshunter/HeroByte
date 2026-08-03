// ImageField is the ONE image-input surface (S3): upload-first, URL fallback.
// The upload path is driven through the real component wiring — hidden file
// input, credential lookup, commit of the stored asset's absolute URL — with
// only the network function stubbed.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImageField } from "../ImageField";
import {
  AssetUploadError,
  uploadedAssetUrl,
} from "../../../features/map-studio/uploads/assetUpload";

vi.mock("../../../hooks/useImageUrlNormalization", () => ({
  useImageUrlNormalization: () => ({
    normalizeUrl: (url: string) => Promise.resolve(url),
    isNormalizing: false,
    normalizationError: null,
    clearError: vi.fn(),
  }),
}));

const HASH = "f".repeat(64);

function pngFile(name = "face.png"): File {
  return new File([new Uint8Array(16)], name, { type: "image/png" });
}

function renderField(overrides: Partial<Parameters<typeof ImageField>[0]> = {}) {
  const onChange = vi.fn();
  const onCommit = vi.fn();
  const uploadFile = vi.fn().mockResolvedValue({
    hash: HASH,
    url: `/assets/${HASH}`,
    mime: "image/png",
    size: 16,
    deduplicated: false,
  });
  const getCredentials = vi.fn().mockReturnValue({ secret: "s3cret", roomId: "room-9" });
  const utils = render(
    <ImageField
      label="Portrait URL"
      value=""
      onChange={onChange}
      onCommit={onCommit}
      uploadFile={uploadFile}
      getCredentials={getCredentials}
      {...overrides}
    />,
  );
  const fileInput = utils.container.querySelector('input[type="file"]') as HTMLInputElement;
  return { onChange, onCommit, uploadFile, getCredentials, fileInput, ...utils };
}

describe("ImageField", () => {
  it("associates the label with the URL input", () => {
    renderField();
    expect(screen.getByLabelText("Portrait URL")).toBeInTheDocument();
  });

  it("restricts the picker to the four formats the server sniffs (HEIC transcodes on iOS)", () => {
    const { fileInput } = renderField();
    expect(fileInput.accept).toBe("image/png,image/jpeg,image/gif,image/webp");
    expect(fileInput.multiple).toBe(false);
  });

  it("the visible button opens the hidden file input", () => {
    const { fileInput } = renderField();
    const click = vi.spyOn(fileInput, "click");
    fireEvent.click(screen.getByRole("button", { name: /upload image/i }));
    expect(click).toHaveBeenCalled();
  });

  it("uploads the picked file with the session credentials and commits the stored URL", async () => {
    const { fileInput, uploadFile, getCredentials, onChange, onCommit } = renderField();
    const file = pngFile();

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    expect(uploadFile).toHaveBeenCalledWith(file, { secret: "s3cret", roomId: "room-9" });
    expect(getCredentials).toHaveBeenCalled();
    const committed = uploadedAssetUrl(HASH);
    expect(onChange).toHaveBeenCalledWith(committed);
    expect(onCommit).toHaveBeenCalledWith(committed);
    expect(committed).toMatch(new RegExp(`^https?://.+/assets/${HASH}$`));
    // Same-file re-pick must re-fire change.
    expect(fileInput.value).toBe("");
  });

  it("shows the typed upload error and never commits on failure", async () => {
    const uploadFile = vi
      .fn()
      .mockRejectedValue(
        new AssetUploadError("quota-exceeded", "The table's asset storage is full."),
      );
    const { fileInput, onCommit } = renderField({ uploadFile });

    fireEvent.change(fileInput, { target: { files: [pngFile()] } });

    expect(await screen.findByRole("alert")).toHaveTextContent(/storage is full/i);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("disables the controls while an upload is in flight", async () => {
    let release!: (v: unknown) => void;
    const uploadFile = vi.fn().mockReturnValue(new Promise((resolve) => (release = resolve)));
    const { fileInput } = renderField({ uploadFile });

    fireEvent.change(fileInput, { target: { files: [pngFile()] } });

    expect(await screen.findByRole("button", { name: /uploading/i })).toBeDisabled();
    expect(screen.getByLabelText("Portrait URL")).toBeDisabled();
    release({
      hash: HASH,
      url: `/assets/${HASH}`,
      mime: "image/png",
      size: 16,
      deduplicated: false,
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /upload image/i })).toBeEnabled(),
    );
  });

  it("commits the trimmed URL on Apply and on Enter", async () => {
    const { onCommit, rerender, onChange } = renderField({ value: "  https://x.example/a.png  " });

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith("https://x.example/a.png"));
    expect(onChange).toHaveBeenCalledWith("https://x.example/a.png");

    onCommit.mockClear();
    rerender(
      <ImageField
        label="Portrait URL"
        value="https://x.example/b.png"
        onChange={onChange}
        onCommit={onCommit}
      />,
    );
    fireEvent.keyDown(screen.getByLabelText("Portrait URL"), { key: "Enter" });
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith("https://x.example/b.png"));
  });

  it("commits on blur only when the surface asked for it", async () => {
    const { onCommit } = renderField({ value: "https://x.example/c.png", commitOnBlur: false });
    fireEvent.blur(screen.getByLabelText("Portrait URL"));
    await Promise.resolve();
    expect(onCommit).not.toHaveBeenCalled();

    const second = renderField({ value: "https://x.example/d.png", commitOnBlur: true });
    fireEvent.blur(within(second.container).getByLabelText("Portrait URL"));
    await waitFor(() => expect(second.onCommit).toHaveBeenCalledWith("https://x.example/d.png"));
  });

  it("renders a Clear button only when the surface supplies one", () => {
    const onClear = vi.fn();
    renderField({ onClear });
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalled();
  });

  it("keeps the camera-roll path honest: no-credentials surfaces its message", async () => {
    // Regression guard for the real wiring: default getCredentials comes from
    // the session bridge; a logged-out state must show the pre-written message,
    // not a crash or a silent no-op.
    const uploadFile = vi
      .fn()
      .mockRejectedValue(
        new AssetUploadError("no-credentials", "Join the table before uploading assets."),
      );
    const { fileInput } = renderField({ uploadFile });
    fireEvent.change(fileInput, { target: { files: [pngFile()] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(/join the table/i);
  });
});
