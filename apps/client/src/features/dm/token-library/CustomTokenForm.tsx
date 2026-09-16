// ============================================================================
// CUSTOM TOKEN FORM
// ============================================================================
// "Add your own": an image (an upload from disk or camera roll, or a pasted
// https link such as imgur), a name, a blurb, tags and a size — the same
// fields the pack's entries carry, so the token searches and picks like one.

import { useId, useState } from "react";
import type { NpcDisposition, TokenSize } from "@herobyte/shared";
import { CUSTOM_TOKEN_LIMITS } from "@herobyte/shared";
import { ImageField } from "../../../components/ui/ImageField";
import { JRPGButton } from "../../../components/ui/JRPGPanel";
import type {
  CustomTokenAddOptions,
  CustomTokenAddResult,
  CustomTokenDraft,
} from "./customTokensContext";
import { impliedStance } from "./customTokenStance";
import { ANCESTRY_TAGS, KIND_TAGS, cleanTag } from "./customTokenTags";
import { canKeepCopy } from "./customTokenImages";
import {
  addStyle,
  chipRowStyle,
  chosenTagStyle,
  fieldGroupStyle,
  fieldStyle,
  formStyle,
  headingStyle,
  keepCopyHintStyle,
  noteFailStyle,
  noteStyle,
  rowStyle,
  suggestedTagStyle,
} from "./customTokenFormStyles";
import { npcDispositionLook } from "../../players/components/npcDisposition";

interface CustomTokenFormProps {
  onAdd: (
    draft: CustomTokenDraft,
    options?: CustomTokenAddOptions,
  ) => Promise<CustomTokenAddResult>;
  disabled?: boolean;
}

const SIZES: TokenSize[] = ["tiny", "small", "medium", "large", "huge", "gargantuan"];

/** One spelling of the three labels, shared with the NPC editor's Stance. */
const STANCES: NpcDisposition[] = ["hostile", "neutral", "friendly"];

export function CustomTokenForm({ onAdd, disabled = false }: CustomTokenFormProps) {
  const [imageUrl, setImageUrl] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagText, setTagText] = useState("");
  const [size, setSize] = useState<TokenSize>("medium");
  // HOSTILE, matching every other surface. Absent means hostile on the wire,
  // in both coercions, in the card and in the NPC editor; the form defaulting
  // to neutral made this the one place that silently disagreed, so a DM who
  // uploaded a dragon and touched nothing broadcast "Neutral" to the table.
  // A kind chip or the select moves it; that is what they are for.
  const [stance, setStance] = useState<NpcDisposition>("hostile");
  // Once the DM has chosen a stance themselves, a later chip must not undo it.
  const [stanceTouched, setStanceTouched] = useState(false);
  // The add draws and uploads an 84px thumbnail before it sends, which is a
  // round trip the DM has to be told about — hence a disabled button that
  // says so, and a line underneath when a step was skipped.
  const [adding, setAdding] = useState(false);
  // `failed` COLOURS the line: four of these say the token is not on the
  // shelf, and they rendered in the same gold as the five that say it is.
  const [note, setNote] = useState<{ text: string; failed: boolean } | null>(null);
  const [keepCopy, setKeepCopy] = useState(true);
  const nameId = useId();
  const descriptionId = useId();
  const tagsId = useId();
  const sizeId = useId();
  const stanceId = useId();

  const addTags = (raw: string) => {
    const next = raw.split(",").map(cleanTag).filter(Boolean);
    if (next.length === 0) return;
    setTags((current) =>
      [...current, ...next.filter((t) => !current.includes(t))].slice(
        0,
        CUSTOM_TOKEN_LIMITS.TAGS_MAX,
      ),
    );
    // Until the DM sets a stance by hand, a kind chip keeps choosing it.
    const implied = impliedStance(next);
    if (implied && !stanceTouched) setStance(implied);
    setTagText("");
  };
  const toggleTag = (tag: string) => {
    if (!tags.includes(tag)) return addTags(tag);
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    // Taking the kind word back takes its stance with it. Removing went
    // straight to setTags, so un-clicking "monster" left the card Enemy with
    // nothing on screen still saying why.
    if (!stanceTouched) setStance(impliedStance(next) ?? "hostile");
  };

  const ready = name.trim().length > 0 && imageUrl.trim().length > 0;
  const submit = () => {
    if (!ready || adding) return;
    // A tag still sitting in the box counts: nobody presses Enter before Add.
    const pending = tagText.split(",").map(cleanTag).filter(Boolean);
    const finalTags = [...tags, ...pending.filter((t) => !tags.includes(t))].slice(
      0,
      CUSTOM_TOKEN_LIMITS.TAGS_MAX,
    );
    const blurb = description.trim();
    setAdding(true);
    setNote(null);
    void Promise.resolve(
      onAdd(
        {
          name: name.trim().slice(0, CUSTOM_TOKEN_LIMITS.NAME_MAX),
          imageUrl: imageUrl.trim(),
          ...(blurb ? { description: blurb.slice(0, CUSTOM_TOKEN_LIMITS.DESCRIPTION_MAX) } : {}),
          tags: finalTags,
          size,
          // Hostile is what absent already means; sending it would only put a
          // word in the saved file that changes nothing.
          ...(stance === "hostile" ? {} : { disposition: stance }),
        },
        { mirror: keepCopy && canKeepCopy(imageUrl) },
      ),
    )
      .then((result) => {
        setNote(result?.note ? { text: result.note, failed: !result.added } : null);
        // Only when it actually landed. Clearing optimistically meant a
        // refused add — a mistyped address, a full shelf — threw away the
        // name, blurb and tags the DM had just typed, on top of telling them
        // nothing. They keep their work and can fix the one field that is
        // wrong.
        if (result?.added) reset();
      })
      // The add itself never rejects by design; if one ever does, the DM sees
      // a line rather than a form stuck on "Adding…" forever.
      .catch(() => setNote({ text: "Could not add that token — try again.", failed: true }))
      .finally(() => setAdding(false));
  };

  const reset = () => {
    setImageUrl("");
    setName("");
    setDescription("");
    setTags([]);
    setTagText("");
    setSize("medium");
    setStance("hostile");
    setStanceTouched(false);
    setKeepCopy(true);
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
      {/* For any https link at somebody else's host — see canKeepCopy. Whether
          the copy can actually be MADE is the host's CORS policy, which nothing
          here can know; the pipeline finds out and says so. */}
      {canKeepCopy(imageUrl) && (
        <label className="custom-token-keep-copy jrpg-text-small">
          <input
            type="checkbox"
            checked={keepCopy}
            onChange={(event) => setKeepCopy(event.target.checked)}
            disabled={disabled}
          />
          <span>
            Keep a copy on this table{" "}
            <span style={keepCopyHintStyle}>— the link stays if the copy cannot be made</span>
          </span>
        </label>
      )}
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
        <div style={{ ...fieldGroupStyle, flex: "0 0 120px" }}>
          <label htmlFor={stanceId} className="jrpg-text-small">
            Stance
          </label>
          <select
            id={stanceId}
            value={stance}
            onChange={(event) => {
              setStance(event.target.value as NpcDisposition);
              setStanceTouched(true);
            }}
            disabled={disabled}
            style={fieldStyle}
          >
            {STANCES.map((option) => (
              <option key={option} value={option}>
                {npcDispositionLook(option).label}
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
                onClick={() => toggleTag(tag)}
                title={`Remove tag ${tag}`}
                className="custom-token-tag"
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
                className="custom-token-tag"
                style={tags.includes(tag) ? chosenTagStyle : suggestedTagStyle}
              >
                {tag}
              </button>
            ))}
          </div>
        ))}
      </div>
      <JRPGButton
        type="submit"
        variant="success"
        disabled={disabled || adding || !ready}
        style={addStyle}
      >
        {adding ? "Adding…" : "＋ Add to library"}
      </JRPGButton>
      {note && (
        <p
          className="jrpg-text-small"
          role="status"
          style={note.failed ? noteFailStyle : noteStyle}
        >
          {note.text}
        </p>
      )}
    </form>
  );
}
