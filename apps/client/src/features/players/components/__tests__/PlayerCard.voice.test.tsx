/**
 * PlayerCard and the voice call, rendered WITHOUT the sibling file's subcomponent
 * mocks: the card's mic button is the call's Mute toggle, so it shows for the viewer's
 * own card while THIS browser is in the call (the voice context, when there is one;
 * else what the server says on player.voice), and the headphones badge shows what the
 * server says about anyone. The memo comparator must repaint the badge when only
 * player.voice changes.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import type { Player, TokenSize } from "@herobyte/shared";
import { PlayerCard } from "../PlayerCard";
import { VoiceContext, type VoiceContextValue } from "../../../voice/VoiceContext";

const createMockPlayer = (overrides?: Partial<Player>): Player => ({
  uid: "player-1",
  name: "Gandalf",
  portrait: "gandalf.jpg",
  micLevel: 0.5,
  hp: 80,
  maxHp: 100,
  isDM: false,
  ...overrides,
});

const createDefaultProps = (overrides?: Partial<React.ComponentProps<typeof PlayerCard>>) => ({
  player: createMockPlayer(),
  isMe: false,
  tokenColor: "#336699",
  token: null,
  tokenSceneObject: null,
  playerDrawings: [],
  statusEffects: [],
  micEnabled: true,
  editingPlayerUID: null,
  nameInput: "",
  onNameInputChange: vi.fn(),
  onNameEdit: vi.fn(),
  onNameSubmit: vi.fn(),
  onToggleMic: vi.fn(),
  onHpChange: vi.fn(),
  editingHpUID: null,
  hpInput: "",
  onHpInputChange: vi.fn(),
  onHpEdit: vi.fn(),
  onHpSubmit: vi.fn(),
  editingMaxHpUID: null,
  maxHpInput: "",
  onMaxHpInputChange: vi.fn(),
  onMaxHpEdit: vi.fn(),
  onMaxHpSubmit: vi.fn(),
  tokenImageUrl: undefined,
  onTokenImageSubmit: vi.fn(),
  tokenId: undefined,
  onApplyPlayerState: vi.fn(),
  onDeleteToken: vi.fn(),
  onStatusEffectsChange: vi.fn(),
  isDM: false,
  viewerIsDM: false,
  tokenLocked: false,
  onToggleTokenLock: vi.fn(),
  tokenSize: "medium" as TokenSize,
  onTokenSizeChange: vi.fn(),
  onAddCharacter: vi.fn(),
  isCreatingCharacter: false,
  characterId: undefined,
  onDeleteCharacter: vi.fn(),
  onFocusToken: vi.fn(),
  initiative: undefined,
  onInitiativeClick: vi.fn(),
  initiativeModifier: undefined,
  ...overrides,
});

const voiceContext = (state: VoiceContextValue["state"]): VoiceContextValue => ({
  selfUid: "player-1",
  state,
  inCall: [],
  links: {},
  audioBlocked: false,
  join: vi.fn(() => Promise.resolve()),
  leave: vi.fn(),
  toggleMute: vi.fn(),
  resumeAudio: vi.fn(),
});

const card = (
  props: React.ComponentProps<typeof PlayerCard>,
  state: VoiceContextValue["state"] | null,
) => {
  const element = <PlayerCard {...props} />;
  return state ? (
    <VoiceContext.Provider value={voiceContext(state)}>{element}</VoiceContext.Provider>
  ) : (
    element
  );
};

const micButton = () => screen.queryByRole("button", { name: /^(Mute|Unmute) mic$/ });

describe("PlayerCard mic button (the call's Mute toggle)", () => {
  it.each(["live", "muted"] as const)(
    "with a voice context that is %s, my card shows the mic even before the server lists me",
    (state) => {
      render(card(createDefaultProps({ isMe: true, player: createMockPlayer() }), state));
      expect(micButton()).toBeInTheDocument();
    },
  );

  it("with a voice context that is off, my card hides the mic even if the server still lists me in the call", () => {
    render(
      card(createDefaultProps({ isMe: true, player: createMockPlayer({ voice: "live" }) }), "off"),
    );
    expect(micButton()).toBeNull();
  });

  it("with a voice context that is joining, my card has no mic yet", () => {
    render(card(createDefaultProps({ isMe: true, player: createMockPlayer() }), "joining"));
    expect(micButton()).toBeNull();
  });

  it("without a voice context it follows player.voice", () => {
    const { unmount } = render(
      card(createDefaultProps({ isMe: true, player: createMockPlayer({ voice: "muted" }) }), null),
    );
    expect(micButton()).toBeInTheDocument();
    unmount();
    render(card(createDefaultProps({ isMe: true, player: createMockPlayer() }), null));
    expect(micButton()).toBeNull();
  });

  it("is only ever on my own card, in the call or not", () => {
    render(
      card(
        createDefaultProps({ isMe: false, player: createMockPlayer({ voice: "live" }) }),
        "live",
      ),
    );
    expect(micButton()).toBeNull();
  });

  it("a voice change alone repaints the mic (the context bypasses the card's memo)", () => {
    const props = createDefaultProps({ isMe: true, player: createMockPlayer() });
    const { rerender } = render(card(props, "off"));
    expect(micButton()).toBeNull();
    rerender(card(props, "live"));
    expect(micButton()).toBeInTheDocument();
  });
});

describe("PlayerCard in-voice badge", () => {
  it("shows 'In voice' for live and 'In voice, muted' for muted, and nothing when absent", () => {
    const { unmount } = render(
      card(createDefaultProps({ player: createMockPlayer({ voice: "live" }) }), null),
    );
    expect(screen.getByRole("img", { name: "In voice" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "In voice, muted" })).toBeNull();
    unmount();

    const muted = render(
      card(createDefaultProps({ player: createMockPlayer({ voice: "muted" }) }), null),
    );
    expect(screen.getByRole("img", { name: "In voice, muted" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "In voice" })).toBeNull();
    muted.unmount();

    render(card(createDefaultProps({ player: createMockPlayer() }), null));
    expect(screen.queryByRole("img", { name: /In voice/ })).toBeNull();
  });

  it("shows what the server says about anyone, whatever this browser's own call state", () => {
    render(
      card(createDefaultProps({ isMe: false, player: createMockPlayer({ voice: "live" }) }), "off"),
    );
    expect(screen.getByRole("img", { name: "In voice" })).toBeInTheDocument();
  });

  it("repaints when ONLY player.voice changes (the memo comparator watches it)", () => {
    const base = createDefaultProps({ player: createMockPlayer() });
    const { rerender } = render(<PlayerCard {...base} />);
    expect(screen.queryByRole("img", { name: /In voice/ })).toBeNull();

    rerender(<PlayerCard {...base} player={{ ...base.player, voice: "live" }} />);
    expect(screen.getByRole("img", { name: "In voice" })).toBeInTheDocument();

    rerender(<PlayerCard {...base} player={{ ...base.player, voice: "muted" }} />);
    expect(screen.getByRole("img", { name: "In voice, muted" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "In voice" })).toBeNull();

    rerender(<PlayerCard {...base} player={{ ...base.player, voice: undefined }} />);
    expect(screen.queryByRole("img", { name: /In voice/ })).toBeNull();
  });
});
