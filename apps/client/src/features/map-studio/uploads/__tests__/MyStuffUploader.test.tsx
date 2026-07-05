import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MyStuffUploader } from "../MyStuffUploader";

function pngFile(name = "torch.png"): File {
  return new File([new Uint8Array(4)], name, { type: "image/png" });
}

describe("MyStuffUploader", () => {
  it("forwards files chosen through the hidden input", () => {
    const onFiles = vi.fn();
    render(<MyStuffUploader busy={false} error={null} onFiles={onFiles} />);

    const input = screen.getByLabelText("My Stuff image files") as HTMLInputElement;
    const file = pngFile();
    fireEvent.change(input, { target: { files: [file] } });

    expect(onFiles).toHaveBeenCalledWith([file]);
  });

  it("forwards files dropped onto the dropzone", () => {
    const onFiles = vi.fn();
    render(<MyStuffUploader busy={false} error={null} onFiles={onFiles} />);

    const dropzone = screen.getByLabelText("Upload images to My Stuff");
    const file = pngFile("crate.png");
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    expect(onFiles).toHaveBeenCalledWith([file]);
  });

  it("ignores drops while a batch is uploading", () => {
    const onFiles = vi.fn();
    render(<MyStuffUploader busy={true} error={null} onFiles={onFiles} />);
    fireEvent.drop(screen.getByLabelText("Upload images to My Stuff"), {
      dataTransfer: { files: [pngFile()] },
    });
    expect(onFiles).not.toHaveBeenCalled();
  });

  it("ignores empty drops", () => {
    const onFiles = vi.fn();
    render(<MyStuffUploader busy={false} error={null} onFiles={onFiles} />);
    fireEvent.drop(screen.getByLabelText("Upload images to My Stuff"), {
      dataTransfer: { files: [] },
    });
    expect(onFiles).not.toHaveBeenCalled();
  });

  it("disables the upload button while busy", () => {
    render(<MyStuffUploader busy={true} error={null} onFiles={vi.fn()} />);
    expect(screen.getByRole("button", { name: /uploading/i })).toBeDisabled();
  });

  it("shows upload errors", () => {
    render(
      <MyStuffUploader busy={false} error="The room's asset storage is full." onFiles={vi.fn()} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("The room's asset storage is full.");
  });
});
