/**
 * FormInput Component
 *
 * A reusable form input component with consistent JRPG styling.
 * Supports text, number, and password input types with automatic value type conversion.
 *
 * Extracted from: apps/client/src/features/dm/components/DMMenu.tsx
 * - PropEditor (text inputs): lines ~160-197
 * - NPCEditor (text/number inputs): lines ~340-453
 * - Session tab (text/password inputs): lines ~1442-1525
 *
 * Extraction date: 2025-10-21
 *
 * @example
 * ```tsx
 * // Text input
 * <FormInput
 *   label="Name"
 *   value={name}
 *   onChange={setName}
 *   onBlur={handleBlur}
 * />
 *
 * // Number input
 * <FormInput
 *   label="HP"
 *   type="number"
 *   value={hp}
 *   onChange={setHp}
 *   min={0}
 * />
 *
 * // Password input
 * <FormInput
 *   label="Password"
 *   type="password"
 *   value={password}
 *   onChange={setPassword}
 *   placeholder="Enter password"
 * />
 * ```
 *
 * @module components/ui/FormInput
 */

import React from 'react';

/**
 * Props for the FormInput component
 */
interface FormInputProps {
  /** Label text displayed above the input */
  label: string;
  /** Input type - defaults to "text" */
  type?: "text" | "number" | "password";
  /** Current value of the input */
  value: string | number;
  /** Callback fired when input value changes */
  onChange: (value: string | number) => void;
  /** Optional callback fired when input loses focus */
  onBlur?: () => void;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Minimum value for number inputs */
  min?: number;
  /** Maximum value for number inputs */
  max?: number;
  /** Step value for number inputs */
  step?: number;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional CSS class names */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

/**
 * FormInput renders a labeled input field with consistent JRPG styling.
 *
 * Features:
 * - Type-safe value handling (string for text/password, number for number)
 * - Automatic number parsing and NaN handling
 * - Password type uses 6px padding (variant)
 * - Optional blur handler
 * - Supports min, max, step for number inputs
 * - Customizable placeholder, className, style
 *
 * @param props - Component props
 * @returns Labeled input element
 */
export const FormInput = React.memo((props: FormInputProps) => {
  const {
    label,
    type = "text",
    value,
    onChange,
    onBlur,
    placeholder,
    min,
    max,
    step,
    disabled,
    className,
    style,
  } = props;

  // Handle input change based on type
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (type === "number") {
      const numValue = parseInt(e.target.value, 10);
      onChange(isNaN(numValue) ? 0 : numValue);
    } else {
      onChange(e.target.value);
    }
  };

  // Handle blur (only if onBlur provided)
  const handleBlur = () => {
    if (onBlur) {
      onBlur();
    }
  };

  // Determine padding based on type
  const padding = type === "password" ? "6px" : "4px";

  return (
    <label
      className="jrpg-text-small"
      style={{ display: "flex", flexDirection: "column", gap: "4px" }}
    >
      {label}
      <input
        type={type}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={className}
        style={{
          width: "100%",
          padding,
          background: "#111",
          color: "var(--jrpg-white)",
          border: "1px solid var(--jrpg-border-gold)",
          ...style,
        }}
      />
    </label>
  );
});

FormInput.displayName = 'FormInput';
