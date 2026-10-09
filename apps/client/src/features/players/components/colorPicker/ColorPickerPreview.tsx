// The colour picker's preview: the character's name on navy, the portrait ring,
// and the token on a dark map floor and under fog, then the colour as a hex code.

export function ColorPickerPreview({ name, hex }: { name: string; hex: string }): JSX.Element {
  return (
    <>
      <div className="color-picker__preview" aria-hidden="true">
        <span className="color-picker__name" style={{ color: hex }}>
          {name}
        </span>
        <span className="color-picker__ring" style={{ borderColor: hex }} />
        <span
          className="color-picker__token color-picker__token--map"
          style={{ background: hex }}
        />
        <span
          className="color-picker__token color-picker__token--fog"
          style={{ background: hex }}
        />
      </div>
      <output className="color-picker__hex" aria-label="Colour code">
        {hex}
      </output>
    </>
  );
}
