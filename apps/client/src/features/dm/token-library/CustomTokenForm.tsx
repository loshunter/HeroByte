// ============================================================================
// CUSTOM TOKEN FORM
// ============================================================================
// "Add your own": an image (an upload from disk or camera roll, or a pasted
// https link such as imgur), a name, a blurb, tags and a size — the same
// fields the pack's entries carry, so the token searches and picks like one.

import { useId, useState } from "react";
import type { TokenSize } from "@herobyte/shared";
import { CUSTOM_TOKEN_LIMITS } from "@herobyte/shared";
import { ImageField } from "../../../components/ui/ImageField";
import { JRPGButton } from "../../../components/ui/JRPGPanel";
import type { CustomTokenDraft } from "./customTokensContext";

interface CustomTokenFormProps {
  onAdd: (draft: CustomTokenDraft) => void;
  disabled?: boolean;
}

const SIZES: TokenSize[] = ["tiny", "small", "medium", "large", "huge", "gargantuan"];

/** Tags worth a click; anything else is typed. Two rows: what it is, and its ancestry. */
const KIND_TAGS = ["monster", "npc", "traveler", "villager", "ally", "boss", "prop"];
const ANCESTRY_TAGS = [
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

const cleanTag = (raw: string) => raw.trim().toLowerCase().slice(0, CUSTOM_TOKEN_LIMITS.TAG_MAX);

export function CustomTokenForm({ onAdd, disabled = false }: CustomTokenFormProps) {
  const [imageUrl, setImageUrl] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagText, setTagText] = useState("");
  const [size, setSize] = useState<TokenSize>("medium");
  const nameId = useId();
  const descriptionId = useId();
  const tagsId = useId();
  const sizeId = useId();

  const addTags = (raw: string) => {
    const next = raw.split(",").map(cleanTag).filter(Boolean);
    if (next.length === 0) return;
    setTags((current) =>
      [...current, ...next.filter((t) => !current.includes(t))].slice(
        0,
        CUSTOM_TOKEN_LIMITS.TAGS_MAX,
      ),
    );
    setTagText("");
  };
  const toggleTag = (tag: string) =>
    tags.includes(tag) ? setTags(tags.filter((t) => t !== tag)) : addTags(tag);

  const ready = name.trim().length > 0 && imageUrl.trim().length > 0;
  const submit = () => {
    if (!ready) return;
    // A tag still sitting in the box counts: nobody presses Enter before Add.
    const pending = tagText.split(",").map(cleanTag).filter(Boolean);
    const finalTags = [...tags, ...pending.filter((t) => !tags.includes(t))].slice(
      0,
      CUSTOM_TOKEN_LIMITS.TAGS_MAX,
    );
    const blurb = description.trim();
    onAdd({
      name: name.trim().slice(0, CUSTOM_TOKEN_LIMITS.NAME_MAX),
      imageUrl: imageUrl.trim(),
      ...(blurb ? { description: blurb.slice(0, CUSTOM_TOKEN_LIMITS.DESCRIPTION_MAX) } : {}),
      tags: finalTags,
      size,
    });
    setImageUrl("");
    setName("");
    setDescription("");
    setTags([]);
    setTagText("");
    setSize("medium");
  };

  return (
    <form
      data-testid="custom-token-form"
      style={formStyle}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <p className="jrpg-text-small" style={headingStyle}>
        Add your own — upload an image, or paste an https link (imgur works)
      </p>
      <ImageField
        label="Image"
        value={imageUrl}
        onChange={setImageUrl}
        onCommit={setImageUrl}
        disabled={disabled}
        compact
      />
      <div style={rowStyle}>
        <div style={fieldGroupStyle}>
          <label htmlFor={nameId} className="jrpg-text-small">
            Name
          </label>
          <input
            id={nameId}
            value={name}
            maxLength={CUSTOM_TOKEN_LIMITS.NAME_MAX}
            placeholder="Old Marta the innkeeper"
            onChange={(event) => setName(event.target.value)}
            disabled={disabled}
            style={fieldStyle}
          />
        </div>
        <div style={{ ...fieldGroupStyle, flex: "0 0 120px" }}>
          <label htmlFor={sizeId} className="jrpg-text-small">
            Size
          </label>
          <select
            id={sizeId}
            value={size}
            onChange={(event) => setSize(event.target.value as TokenSize)}
            disabled={disabled}
            style={fieldStyle}
          >
            {SIZES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={fieldGroupStyle}>
        <label htmlFor={descriptionId} className="jrpg-text-small">
          Description
        </label>
        <input
          id={descriptionId}
          value={description}
          maxLength={CUSTOM_TOKEN_LIMITS.DESCRIPTION_MAX}
          placeholder="What the table should know at a glance"
          onChange={(event) => setDescription(event.target.value)}
          disabled={disabled}
          style={fieldStyle}
        />
      </div>
      <div style={fieldGroupStyle}>
        <label htmlFor={tagsId} className="jrpg-text-small">
          Tags
        </label>
        <input
          id={tagsId}
          value={tagText}
          placeholder="comma separated, or pick below — searchable like the pack's"
          onChange={(event) => setTagText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addTags(tagText);
            }
          }}
          onBlur={() => addTags(tagText)}
          disabled={disabled}
          style={fieldStyle}
        />
        {tags.length > 0 && (
          <div style={chipRowStyle} aria-label="Chosen tags">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setTags(tags.filter((t) => t !== tag))}
                title={`Remove tag ${tag}`}
                style={chosenTagStyle}
              >
                {tag} ✕
              </button>
            ))}
          </div>
        )}
        {[KIND_TAGS, ANCESTRY_TAGS].map((group, index) => (
          <div key={index} style={chipRowStyle} aria-label={index === 0 ? "Kind" : "Ancestry"}>
            {group.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                aria-pressed={tags.includes(tag)}
                disabled={disabled}
                style={tags.includes(tag) ? chosenTagStyle : suggestedTagStyle}
              >
                {tag}
              </button>
            ))}
          </div>
        ))}
      </div>
      <JRPGButton type="submit" variant="success" disabled={disabled || !ready} style={addStyle}>
        ＋ Add to library
      </JRPGButton>
    </form>
  );
}

const formStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "8px",
  border: "1px dashed var(--jrpg-cyan, #00e0d1)",
  borderRadius: "4px",
} as const;

const headingStyle = { margin: 0, fontSize: "10px", color: "var(--jrpg-cyan, #00e0d1)" };

const rowStyle = { display: "flex", gap: "8px", flexWrap: "wrap" } as const;

const fieldGroupStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "3px",
  flex: "1 1 160px",
  fontSize: "10px",
} as const;

const fieldStyle = { fontSize: "11px", padding: "4px 6px", minWidth: 0 } as const;

const chipRowStyle = { display: "flex", gap: "4px", flexWrap: "wrap" } as const;

// Tag chips are compact on a desktop; no inline min-height, so the phone's
// coarse-pointer floor can lift them to 44px — a row of ten ancestries wraps.
const suggestedTagStyle = {
  fontFamily: "var(--font-body)",
  fontSize: "10px",
  padding: "3px 7px",
  background: "var(--jrpg-panel, #232638)",
  color: "var(--jrpg-white)",
  border: "1px solid var(--jrpg-border-gold, #8a7445)",
  borderRadius: "10px",
  cursor: "pointer",
} as const;

const chosenTagStyle = {
  ...suggestedTagStyle,
  background: "var(--jrpg-cyan, #00e0d1)",
  color: "var(--jrpg-navy, #0f0e1e)",
  border: "1px solid var(--jrpg-cyan, #00e0d1)",
} as const;

const addStyle = { fontSize: "10px", padding: "6px 12px", alignSelf: "flex-start" } as const;
