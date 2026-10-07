// The voice control: Join when out, Mute/Unmute + Leave when in, how many are in
// the call, who (on the phone panel), who cannot be reached, a tap-to-hear button
// when the browser refused to play, the mic notice beside the Join that was
// pressed, and nothing at all on an idle phone chip or without a voice provider.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { VoiceControl, voiceNoticeOwner } from "../VoiceControl";
import { VoiceContext, type VoiceContextValue } from "../VoiceContext";
import { __resetMicNoticeForTests, claimMicNotice, setMicNotice } from "../../../hooks/micNotice";

beforeEach(() => __resetMicNoticeForTests());
afterEach(() => {
  cleanup();
  __resetMicNoticeForTests();
});

const SELF = "me";

function value(overrides: Partial<VoiceContextValue> = {}): VoiceContextValue {
  return {
    selfUid: SELF,
    state: "off",
    inCall: [],
    links: {},
    audioBlocked: false,
    join: vi.fn(() => Promise.resolve()),
    leave: vi.fn(),
    toggleMute: vi.fn(),
    resumeAudio: vi.fn(),
    ...overrides,
  };
}

const show = (variant: "header" | "chip" | "panel", voice: VoiceContextValue) =>
  render(
    <VoiceContext.Provider value={voice}>
      <VoiceControl variant={variant} />
    </VoiceContext.Provider>,
  );

const me = { uid: SELF, name: "Mira", muted: false };
const sam = { uid: "sam", name: "Sam", muted: false };
const bo = { uid: "bo", name: "Bo", muted: true };

describe("out of the call", () => {
  it("renders nothing without a provider", () => {
    const { container } = render(<VoiceControl variant="header" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("header: shows Join and calls join when pressed", () => {
    const voice = value();
    show("header", voice);
    fireEvent.click(screen.getByRole("button", { name: /Join voice/ }));
    expect(voice.join).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /Leave voice/ })).toBeNull();
  });

  it("chip: renders nothing when off and nobody else is in the call", () => {
    const { container } = show("chip", value());
    expect(container).toBeEmptyDOMElement();
  });

  it("chip: stays, with the notice, when off and alone and a notice is showing for it", () => {
    show("chip", value());
    expect(screen.queryByRole("group")).toBeNull();
    act(() => setMicNotice("Your mic stopped, so you left the call."));
    expect(screen.getByRole("group", { name: "Voice chat" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Your mic stopped, so you left the call.");
    expect(screen.getByRole("button", { name: /Join voice/ })).toBeInTheDocument();
  });

  it("chip: goes again when the notice is cleared", () => {
    const { container } = show("chip", value());
    act(() => setMicNotice("Mic blocked."));
    expect(container).not.toBeEmptyDOMElement();
    act(() => setMicNotice(null));
    expect(container).toBeEmptyDOMElement();
  });

  it("chip: a notice another control claimed does not keep it on screen", () => {
    claimMicNotice(voiceNoticeOwner("panel"));
    const { container } = show("chip", value());
    act(() => setMicNotice("Mic blocked."));
    expect(container).toBeEmptyDOMElement();
  });

  it("chip: shows Join and the count when someone else is in the call", () => {
    show("chip", value({ inCall: [sam] }));
    expect(screen.getByRole("button", { name: /Join voice/ })).toBeInTheDocument();
    expect(screen.getByText("1 in call")).toBeInTheDocument();
  });

  it("chip: shows while joining even with nobody else in the call", () => {
    show("chip", value({ state: "joining" }));
    expect(screen.getByRole("button", { name: "Joining…" })).toHaveAttribute("aria-busy", "true");
  });

  it("panel: always shows Join, even on an idle table", () => {
    show("panel", value());
    expect(screen.getByRole("button", { name: /Join voice/ })).toBeInTheDocument();
    expect(screen.queryByText(/in call/)).toBeNull();
  });

  it("out of the call, the count leaves this player out", () => {
    // A stale self entry (still listed while off) is not counted.
    show("header", value({ inCall: [me, sam, bo] }));
    expect(screen.getByText("2 in call")).toBeInTheDocument();
  });

  it("Join claims the mic notice: a failure shows beside it, not beside another control", () => {
    claimMicNotice("card-a");
    show("header", value());
    act(() => setMicNotice("Mic blocked."));
    expect(screen.getByRole("status")).toHaveTextContent("");
    fireEvent.click(screen.getByRole("button", { name: /Join voice/ }));
    act(() => setMicNotice("Mic blocked again."));
    expect(screen.getByRole("status")).toHaveTextContent("Mic blocked again.");
    expect(voiceNoticeOwner("header")).toBe("voice-control:header");
  });
});

describe("in the call", () => {
  it("live: Mute and Leave voice; the count includes this player", () => {
    const voice = value({ state: "live", inCall: [me, sam] });
    show("header", voice);
    fireEvent.click(screen.getByRole("button", { name: /Mute/ }));
    expect(voice.toggleMute).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /Leave voice/ }));
    expect(voice.leave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /Join voice/ })).toBeNull();
    expect(screen.getByText("2 in call")).toBeInTheDocument();
  });

  it("muted: the button reads Unmute", () => {
    show("header", value({ state: "muted", inCall: [{ ...me, muted: true }] }));
    expect(screen.getByRole("button", { name: /Unmute/ })).toBeInTheDocument();
    expect(screen.getByText("1 in call")).toBeInTheDocument();
  });

  it("chip: shows while in the call alone", () => {
    show("chip", value({ state: "live", inCall: [me] }));
    expect(screen.getByRole("button", { name: /Leave voice/ })).toBeInTheDocument();
  });

  it("panel: names everyone, 'You' for this player and '(muted)' for the muted", () => {
    show("panel", value({ state: "live", inCall: [me, sam, bo] }));
    expect(screen.getByText("In the call: You, Sam, Bo (muted)")).toBeInTheDocument();
  });

  it("header: the names ride the count's title, not a written line", () => {
    show("header", value({ state: "live", inCall: [me, bo] }));
    expect(screen.getByText("2 in call")).toHaveAttribute("title", "You, Bo (muted)");
    expect(screen.queryByText(/In the call:/)).toBeNull();
  });

  it("names everyone this browser cannot reach", () => {
    show(
      "header",
      value({
        state: "live",
        inCall: [me, sam, bo],
        links: { sam: "failing", bo: "failing" },
      }),
    );
    expect(screen.getByText("Can't reach Sam, Bo")).toBeInTheDocument();
  });

  it("says nothing about connecting or connected links", () => {
    show(
      "header",
      value({
        state: "live",
        inCall: [me, sam, bo],
        links: { sam: "connecting", bo: "connected" },
      }),
    );
    expect(screen.queryByText(/Can't reach/)).toBeNull();
  });

  it("a failing link is not mentioned while out of the call", () => {
    show("header", value({ state: "off", inCall: [sam], links: { sam: "failing" } }));
    expect(screen.queryByText(/Can't reach/)).toBeNull();
  });
});

describe("blocked playback", () => {
  it("shows Tap to hear voice, which resumes the audio", () => {
    const voice = value({ state: "live", inCall: [me, sam], audioBlocked: true });
    show("chip", voice);
    fireEvent.click(screen.getByRole("button", { name: /Tap to hear voice/ }));
    expect(voice.resumeAudio).toHaveBeenCalledTimes(1);
  });

  it("no tap-to-hear button while playback is allowed", () => {
    show("chip", value({ state: "live", inCall: [me, sam] }));
    expect(screen.queryByRole("button", { name: /Tap to hear voice/ })).toBeNull();
  });
});

describe("the status region", () => {
  it("is empty when there is nothing to say", () => {
    show("header", value({ state: "live", inCall: [me, sam], links: { sam: "connected" } }));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("is there (and empty) even out of the call, so a later notice is announced", () => {
    show("panel", value());
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("holds the Can't reach line", () => {
    show("header", value({ state: "live", inCall: [me, sam], links: { sam: "failing" } }));
    expect(screen.getByRole("status")).toHaveTextContent("Can't reach Sam");
  });

  it("holds the browser-paused line (and the tap-to-hear button stays outside it)", () => {
    show("chip", value({ state: "live", inCall: [me, sam], audioBlocked: true }));
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("The browser paused the voices.");
    expect(within(status).queryByRole("button")).toBeNull();
    expect(screen.getByRole("button", { name: /Tap to hear voice/ })).toBeInTheDocument();
  });

  it("holds the mic notice, and says all three at once when all three apply", () => {
    show(
      "header",
      value({
        state: "live",
        inCall: [me, sam],
        links: { sam: "failing" },
        audioBlocked: true,
      }),
    );
    act(() => setMicNotice("Mic blocked."));
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Mic blocked.");
    expect(status).toHaveTextContent("The browser paused the voices.");
    expect(status).toHaveTextContent("Can't reach Sam");
  });
});

describe("the notice owner is the placement that was pressed", () => {
  const both = (voice: VoiceContextValue) =>
    render(
      <VoiceContext.Provider value={voice}>
        <VoiceControl variant="chip" />
        <VoiceControl variant="panel" />
      </VoiceContext.Provider>,
    );
  const regionOf = (container: HTMLElement, variant: "chip" | "panel") =>
    within(container.querySelector(`.voice-control--${variant}`) as HTMLElement).getByRole(
      "status",
    );

  it("names one owner per placement", () => {
    expect(
      new Set(["header", "chip", "panel"].map((v) => voiceNoticeOwner(v as "chip"))).size,
    ).toBe(3);
  });

  it("a Join pressed in the chip shows the failure in the chip, not in the panel beside it", () => {
    const { container } = both(value({ inCall: [sam] }));
    const chip = container.querySelector(".voice-control--chip") as HTMLElement;
    fireEvent.click(within(chip).getByRole("button", { name: /Join voice/ }));
    act(() => setMicNotice("Mic blocked."));
    expect(regionOf(container, "chip")).toHaveTextContent("Mic blocked.");
    expect(regionOf(container, "panel")).toBeEmptyDOMElement();
  });

  it("a Join pressed in the panel shows it in the panel, not in the chip", () => {
    const { container } = both(value({ inCall: [sam] }));
    const panel = container.querySelector(".voice-control--panel") as HTMLElement;
    fireEvent.click(within(panel).getByRole("button", { name: /Join voice/ }));
    act(() => setMicNotice("Mic blocked."));
    expect(regionOf(container, "panel")).toHaveTextContent("Mic blocked.");
    expect(regionOf(container, "chip")).toBeEmptyDOMElement();
  });
});
