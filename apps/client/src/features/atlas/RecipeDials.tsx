// ============================================================================
// RECIPE DIALS — the picker both generation surfaces share
// ============================================================================
// The kick panel and the Atlas tab's generate panel offer the same choice —
// which recipe, and that recipe's own dials — so they ask for it in one place.
// Two copies would drift the moment a third recipe lands, and the phone
// measures both against the same 44px floor.
//
// No inline min-height on these controls, deliberately: the mobile touch floor
// is one `(pointer: coarse)` rule giving every control inside a mobile surface
// a 44px min-height, and an inline min-* would beat it — which is the whole
// reason that floor uses min-* rather than padding.

import type { BuildingRecipeParams, DungeonRecipeParams, GenerateRequest } from "@herobyte/shared";

const selectStyle = { fontSize: "11px" } as const;
const labelStyle = {
  fontSize: "9px",
  display: "flex",
  flexDirection: "column",
  gap: "3px",
} as const;

const DUNGEON_DEFAULTS = { theme: "stone", density: "medium" } as const;
const BUILDING_DEFAULT_KIND = "tavern";

export interface RecipeDialsProps {
  recipe: GenerateRequest;
  onChange: (recipe: GenerateRequest) => void;
  /** Distinguishes this panel's controls when several share a screen. */
  labelSuffix?: string;
}

export function RecipeDials({ recipe, onChange, labelSuffix }: RecipeDialsProps) {
  const label = (name: string) => (labelSuffix ? `${name} for ${labelSuffix}` : name);

  return (
    <>
      <label style={labelStyle}>
        Recipe
        <select
          aria-label={label("Recipe")}
          value={recipe.recipeId}
          onChange={(event) =>
            onChange(
              event.target.value === "building"
                ? { recipeId: "building", kind: BUILDING_DEFAULT_KIND, size: recipe.size }
                : { recipeId: "dungeon", ...DUNGEON_DEFAULTS, size: recipe.size },
            )
          }
          style={selectStyle}
        >
          <option value="dungeon">dungeon</option>
          <option value="building">building</option>
        </select>
      </label>

      {recipe.recipeId === "dungeon" ? (
        <>
          <label style={labelStyle}>
            Theme
            <select
              aria-label={label("Theme")}
              value={recipe.theme}
              onChange={(event) =>
                onChange({ ...recipe, theme: event.target.value as DungeonRecipeParams["theme"] })
              }
              style={selectStyle}
            >
              <option value="stone">stone</option>
              <option value="wood">wood</option>
            </select>
          </label>
          <label style={labelStyle}>
            Density
            <select
              aria-label={label("Density")}
              value={recipe.density}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  density: event.target.value as DungeonRecipeParams["density"],
                })
              }
              style={selectStyle}
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </label>
        </>
      ) : (
        <label style={labelStyle}>
          Kind
          <select
            aria-label={label("Kind")}
            value={recipe.kind}
            onChange={(event) =>
              onChange({ ...recipe, kind: event.target.value as BuildingRecipeParams["kind"] })
            }
            style={selectStyle}
          >
            <option value="tavern">tavern</option>
            <option value="shop">shop</option>
            <option value="warehouse">warehouse</option>
            <option value="house">house</option>
          </select>
        </label>
      )}

      <label style={labelStyle}>
        Size
        <select
          aria-label={label("Size")}
          value={recipe.size}
          onChange={(event) =>
            onChange({ ...recipe, size: event.target.value as GenerateRequest["size"] })
          }
          style={selectStyle}
        >
          <option value="small">small</option>
          <option value="medium">medium</option>
          <option value="large">large</option>
        </select>
      </label>
    </>
  );
}
