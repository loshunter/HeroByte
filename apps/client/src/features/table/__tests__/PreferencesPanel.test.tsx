import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { PreferencesPanel } from "../PreferencesPanel";
import { __resetJuiceSettingsForTests, getJuiceSettings } from "../../juice/juiceSettings";
import { installMemoryStorage } from "../../../test-utils/memoryStorage";

vi.mock("../../juice/sfxEngine", () => ({ sfxEngine: { play: vi.fn(), resume: vi.fn() } }));

beforeEach(() => {
  installMemoryStorage();
  __resetJuiceSettingsForTests({ motion: "full", muted: false, volume: 0.6 });
});
afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-motion");
  vi.clearAllMocks();
});

describe("PreferencesPanel — Display and Sound & motion", () => {
  it("names its two groups as the plan does", () => {
    render(<PreferencesPanel crtFilter={false} onCrtFilterChange={vi.fn()} />);
    expect(screen.getByRole("group", { name: "Display" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Sound & motion" })).toBeInTheDocument();
  });

  it("Display: the CRT button shows its state and asks for the opposite", () => {
    const onCrtFilterChange = vi.fn();
    const { rerender } = render(
      <PreferencesPanel crtFilter={false} onCrtFilterChange={onCrtFilterChange} />,
    );
    const crt = screen.getByRole("button", { name: "📺 CRT" });
    expect(crt).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(crt);
    expect(onCrtFilterChange).toHaveBeenLastCalledWith(true);

    rerender(<PreferencesPanel crtFilter onCrtFilterChange={onCrtFilterChange} />);
    expect(screen.getByRole("button", { name: "📺 CRT" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "📺 CRT" }));
    expect(onCrtFilterChange).toHaveBeenLastCalledWith(false);
  });

  it("Sound & motion: Motion, Mute and Volume write the existing herobyte:juice key, same shape", () => {
    render(<PreferencesPanel crtFilter={false} onCrtFilterChange={vi.fn()} />);
    const group = within(screen.getByRole("group", { name: "Sound & motion" }));

    fireEvent.change(group.getByRole("combobox", { name: "Motion" }), {
      target: { value: "subtle" },
    });
    fireEvent.click(group.getByLabelText("Mute sound effects"));
    fireEvent.change(group.getByRole("slider", { name: "Volume" }), { target: { value: "0.25" } });

    expect(getJuiceSettings()).toEqual({ motion: "subtle", muted: true, volume: 0.25 });
    // The key and the shape an existing choice was stored under: moving the
    // control must not orphan anyone's saved volume or motion level.
    expect(JSON.parse(localStorage.getItem("herobyte:juice") ?? "null")).toEqual({
      motion: "subtle",
      muted: true,
      volume: 0.25,
    });
    // Muting disables the volume slider, as before.
    expect(group.getByRole("slider", { name: "Volume" })).toBeDisabled();
  });

  it("shows a stored choice as it was left: a saved Off is Off, not reset to Full", () => {
    __resetJuiceSettingsForTests({ motion: "off", muted: true, volume: 0.3 });
    render(<PreferencesPanel crtFilter={false} onCrtFilterChange={vi.fn()} />);
    const group = within(screen.getByRole("group", { name: "Sound & motion" }));
    expect(group.getByRole("combobox", { name: "Motion" })).toHaveValue("off");
    expect(group.getByLabelText("Mute sound effects")).toBeChecked();
  });

  it("says both are for you only, and that Sound & motion is kept in this browser", () => {
    render(<PreferencesPanel crtFilter={false} onCrtFilterChange={vi.fn()} />);
    const display = within(screen.getByRole("group", { name: "Display" }));
    const sound = within(screen.getByRole("group", { name: "Sound & motion" }));
    expect(display.getByText(/for you only/i)).toBeInTheDocument();
    expect(sound.getByText(/for you only/i)).toBeInTheDocument();
    expect(sound.getByText(/kept in this browser/i)).toBeInTheDocument();
  });
});
