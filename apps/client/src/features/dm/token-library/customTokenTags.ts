// The add form's tag vocabulary, and the one rule for cleaning a typed one.
//
// Its own module because the form kept crossing the 350-line guard and this is
// the part with the least to do with rendering: two word lists and a
// normaliser, all three of which the stance rule (customTokenStance.ts) reads
// against.

import { CUSTOM_TOKEN_LIMITS } from "@herobyte/shared";

/** Tags worth a click; anything else is typed. What it IS. */
export const KIND_TAGS = ["monster", "npc", "traveler", "villager", "ally", "boss", "prop"];

/** …and where it is from. These say nothing about whose side it is on. */
export const ANCESTRY_TAGS = [
  "human",
  "elf",
  "dwarf",
  "halfling",
  "gnome",
  "half-elf",
  "half-orc",
  "dragonborn",
  "tiefling",
  "orc",
];

/** One spelling per tag: trimmed, lower-cased, capped — as the server stores them. */
export const cleanTag = (raw: string) =>
  raw.trim().toLowerCase().slice(0, CUSTOM_TOKEN_LIMITS.TAG_MAX);
