// The mic control's failure notice (U10b): beside the control, announced as a status, tied
// to the button, shown ONCE (beside the control that was pressed) however many characters
// the player has, and kept until the next try. Also the button's face: the mic's state.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CardControls } from "../CardControls";
import { __resetMicNoticeForTests, setMicNotice } from "../../../../hooks/micNotice";

beforeEach(() => __resetMicNoticeForTests());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  __resetMicNoticeForTests();
});

const controls = (canControlMic = true, controlId = "card-a") =>
  render(
    <CardControls
      controlId={controlId}
      canControlMic={canControlMic}
      canOpenSettings={!canControlMic}
      micEnabled={false}
      onToggleMic={vi.fn()}
      onOpenSettings={vi.fn()}
    />,
  );

it("keeps an empty status region mounted from the start (a live region added already filled is not reliably announced)", () => {
  controls();
  const status = screen.getByRole("status");
  expect(status).toHaveTextContent("");
  expect(screen.getByRole("button", { name: "Unmute mic" })).not.toHaveAttribute(
    "aria-describedby",
  );
});

it("fills the same status region when the mic fails and ties it to the button", () => {
  controls();
  const before = screen.getByRole("status");
  act(() => setMicNotice("Mic blocked. Allow it, then try again."));
  const status = screen.getByRole("status");
  expect(status).toBe(before);
  expect(status).toHaveTextContent("Mic blocked. Allow it, then try again.");
  expect(screen.getByRole("button", { name: "Unmute mic" })).toHaveAttribute(
    "aria-describedby",
    status.id,
  );
});

it("empties the status when the notice is cleared", () => {
  controls();
  act(() => setMicNotice("Something."));
  act(() => setMicNotice(null));
  expect(screen.getByRole("status")).toHaveTextContent("");
});

it("renders no status on a card whose microphone is not yours to control (its settings control still renders)", () => {
  controls(false);
  expect(screen.getByRole("button", { name: "Open player settings" })).toBeInTheDocument();
  act(() => setMicNotice("Microphone blocked."));
  expect(screen.queryByRole("status")).toBeNull();
});

it("shows the notice beside the control that was pressed, once, when a player has two characters", () => {
  render(
    <>
      <div data-testid="first">
        <CardControls
          controlId="char-1"
          canControlMic
          canOpenSettings={false}
          micEnabled={false}
          onToggleMic={vi.fn()}
          onOpenSettings={vi.fn()}
        />
      </div>
      <div data-testid="second">
        <CardControls
          controlId="char-2"
          canControlMic
          canOpenSettings={false}
          micEnabled={false}
          onToggleMic={vi.fn()}
          onOpenSettings={vi.fn()}
        />
      </div>
    </>,
  );
  const [firstMic, secondMic] = screen.getAllByRole("button", { name: "Unmute mic" });
  fireEvent.click(secondMic);
  act(() => setMicNotice("Mic blocked. Allow it, then try again."));
  const texts = screen.getAllByRole("status").map((el) => el.textContent);
  expect(texts).toEqual(["", "Mic blocked. Allow it, then try again."]);
  expect(secondMic).toHaveAttribute("aria-describedby");
  expect(firstMic).not.toHaveAttribute("aria-describedby");
});

it("is still there a minute later and after the card is mounted again (it is not a toast)", () => {
  vi.useFakeTimers();
  const view = controls();
  fireEvent.click(screen.getByRole("button", { name: "Unmute mic" }));
  act(() => setMicNotice("Mic blocked. Allow it, then try again."));
  act(() => {
    vi.advanceTimersByTime(60_000);
  });
  expect(screen.getByRole("status")).toHaveTextContent("Mic blocked");
  view.unmount();
  controls();
  expect(screen.getByRole("status")).toHaveTextContent("Mic blocked");
});

it.each([
  [true, "Mute mic", "🎤", "btn-success", "btn-danger"],
  [false, "Unmute mic", "🔇", "btn-danger", "btn-success"],
])(
  "micEnabled %s: the button shows the mic's state (green 🎤 live, red 🔇 muted)",
  (micEnabled, name, icon, shown, absent) => {
    render(
      <CardControls
        controlId="card-a"
        canControlMic
        canOpenSettings={false}
        micEnabled={micEnabled}
        onToggleMic={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );
    const button = screen.getByRole("button", { name });
    expect(button).toHaveTextContent(icon);
    expect(button).toHaveAttribute("title", name);
    expect(button).toHaveClass("btn", shown);
    expect(button).not.toHaveClass(absent);
  },
);
