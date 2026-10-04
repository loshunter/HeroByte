import { useEffect, useRef, useState } from "react";

// Keep this hook in the mounted parent, including renders that return null.
export function useStatusEffectsPicker(
  selectedEffects: string[],
  onStatusEffectsChange: (effects: string[]) => void,
) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [localEffects, setLocalEffects] = useState<string[]>(selectedEffects);

  const handleToggleEffect = (value: string) => {
    const newEffects = localEffects.includes(value)
      ? localEffects.filter((e) => e !== value)
      : [...localEffects, value];
    setLocalEffects(newEffects);
    onStatusEffectsChange(newEffects);
  };

  useEffect(() => {
    if (!dropdownOpen) {
      setLocalEffects(selectedEffects);
    }
  }, [selectedEffects, dropdownOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpen]);

  return { dropdownOpen, setDropdownOpen, dropdownRef, localEffects, handleToggleEffect };
}

export type StatusEffectsPickerState = ReturnType<typeof useStatusEffectsPicker>;
