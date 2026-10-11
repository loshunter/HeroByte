// A refusal toasted from inside a dialog ("Up to 5 characters each" from Add Character)
// must be read above that dialog's backdrop: the live evaluation found it under it.

import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { ToastContainer } from "../Toast";
import { CharacterCreationModal } from "../../../features/players/components/CharacterCreationModal";

const zOf = (element: Element | null) => Number((element as HTMLElement | null)?.style.zIndex);

describe("the toast stack", () => {
  it("sits above the Add Character dialog's backdrop", () => {
    const toasts = render(
      <ToastContainer
        messages={[{ id: "t", type: "info", message: "Up to 5" }]}
        onDismiss={vi.fn()}
      />,
    );
    render(<CharacterCreationModal isOpen onCreateCharacter={() => false} onClose={vi.fn()} />);
    const stack = toasts.container.querySelector("[title='Click to dismiss']")!.parentElement;
    // The dialog may portal to the body: look for its fixed backdrop anywhere.
    const backdrop = [...document.body.querySelectorAll<HTMLElement>("div")].find(
      (div) => div.style.position === "fixed" && /Add Character/i.test(div.textContent ?? ""),
    )!;
    expect(backdrop).toBeDefined();
    expect(zOf(stack)).toBeGreaterThan(zOf(backdrop));
  });
});
