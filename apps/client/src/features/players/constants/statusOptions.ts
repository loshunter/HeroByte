// ============================================================================
// STATUS OPTIONS
// ============================================================================
// Comprehensive list of D&D status effects for character tokens

export interface StatusOption {
  value: string;
  emoji: string;
  label: string;
}

export const STATUS_OPTIONS: StatusOption[] = [
  // Core D&D Conditions
  { value: "prone", emoji: "🧎", label: "Prone" },
  { value: "poisoned", emoji: "🤢", label: "Poisoned" },
  { value: "grappled", emoji: "🪢", label: "Grappled" },
  { value: "unconscious", emoji: "😴", label: "Unconscious" },
  { value: "restrained", emoji: "⛓️", label: "Restrained" },
  { value: "stunned", emoji: "😵", label: "Stunned" },
  { value: "paralyzed", emoji: "🧊", label: "Paralyzed" },
  { value: "blinded", emoji: "🙈", label: "Blinded" },
  { value: "deafened", emoji: "🙉", label: "Deafened" },
  { value: "petrified", emoji: "🗿", label: "Petrified" },
  { value: "incapacitated", emoji: "🚫", label: "Incapacitated" },
  { value: "frightened", emoji: "😱", label: "Frightened" },
  { value: "charmed", emoji: "😍", label: "Charmed" },
  { value: "invisible", emoji: "🫥", label: "Invisible" },
  { value: "surprised", emoji: "😲", label: "Surprised" },

  // Health States
  { value: "dead", emoji: "💀", label: "Dead" },
  { value: "dying", emoji: "☠️", label: "Dying" },
  { value: "stabilized", emoji: "🤕", label: "Stabilized" },
  { value: "exhausted", emoji: "😫", label: "Exhausted" },
  { value: "bloodied", emoji: "💔", label: "Bloodied" },
  { value: "diseased", emoji: "☣️", label: "Diseased" },

  // Elemental Effects
  { value: "burning", emoji: "🔥", label: "Burning" },
  { value: "frozen", emoji: "❄️", label: "Frozen" },

  // Buffs
  { value: "blessed", emoji: "😇", label: "Blessed" },
  { value: "bardic-inspiration", emoji: "🎶", label: "Bardic Inspiration" },
  { value: "shield-of-faith", emoji: "🛡️", label: "Shield of Faith" },
  { value: "heroic-inspiration", emoji: "🎖️", label: "Heroic Inspiration" },
  { value: "hasted", emoji: "⚡", label: "Hasted" },

  // Debuffs
  { value: "hexed", emoji: "😈", label: "Hexed" },
  { value: "hunters-mark", emoji: "🎯", label: "Hunter's Mark" },
  { value: "bane", emoji: "👿", label: "Bane" },
  { value: "slowed", emoji: "🐌", label: "Slowed" },

  // Combat States
  { value: "rage", emoji: "😠", label: "Rage" },
  { value: "concentration", emoji: "🧠", label: "Concentration" },

  // Special States
  { value: "flying", emoji: "🪽", label: "Flying" },
  { value: "polymorphed", emoji: "🐑", label: "Polymorphed" },
  { value: "dazed", emoji: "😵‍💫", label: "Dazed" },
  { value: "confused", emoji: "😕", label: "Confused" },
];
