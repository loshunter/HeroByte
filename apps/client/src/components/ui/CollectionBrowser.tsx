import { useId } from "react";
import { useLocalEscape } from "../../features/interaction/useEscapeOwner";
import "./collectionBrowser.css";

/** Presentation only: each collection retains its own catalog, state and authority. */
export function CollectionSearch({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  const localEscape = useLocalEscape();
  return (
    <label className="collection-search" htmlFor={id}>
      {label}
      <input
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            if (value) localEscape(event, () => onChange(""));
            return;
          }
          event.stopPropagation();
        }}
      />
    </label>
  );
}

export function CollectionPreview({
  label,
  name,
  imageUrl,
  fill,
  detail,
}: {
  label: string;
  name: string;
  imageUrl?: string;
  fill?: string;
  detail?: string;
}) {
  return (
    <div role="group" aria-label={label} className="collection-preview">
      {imageUrl ? (
        <img src={imageUrl} alt={name} draggable={false} />
      ) : (
        <span
          className="collection-preview__swatch"
          aria-hidden="true"
          style={{ background: fill }}
        />
      )}
      <div>
        <small>{label}</small>
        <strong>{name}</strong>
        {detail && <span>{detail}</span>}
      </div>
    </div>
  );
}
