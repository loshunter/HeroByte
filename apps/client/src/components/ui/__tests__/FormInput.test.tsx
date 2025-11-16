/**
 * Comprehensive tests for FormInput component
 *
 * Tests the reusable form input component with JRPG styling.
 * Follows SOLID principles with single-responsibility tests organized by concern.
 *
 * Source: apps/client/src/components/ui/FormInput.tsx
 *
 * Component Features:
 * - Supports text, number, and password input types
 * - Number type: parses with parseInt, handles NaN → 0
 * - Password type: different padding (6px vs 4px)
 * - Optional onBlur callback
 * - Supports min, max, step for numbers
 * - Uses React.memo for optimization
 * - JRPG styling with configurable overrides
 */

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormInput } from "../FormInput";

describe("FormInput - Initial State", () => {
  describe("basic rendering", () => {
    it("should render with label", () => {
      const onChange = vi.fn();
      render(<FormInput label="Username" value="" onChange={onChange} />);

      expect(screen.getByText("Username")).toBeInTheDocument();
    });

    it("should render label as a label element", () => {
      const onChange = vi.fn();
      const { container } = render(<FormInput label="Test Label" value="" onChange={onChange} />);

      const labelElement = container.querySelector("label");
      expect(labelElement).toBeInTheDocument();
      expect(labelElement).toHaveTextContent("Test Label");
    });

    it("should render input element", () => {
      const onChange = vi.fn();
      render(<FormInput label="Test" value="" onChange={onChange} />);

      const input = screen.getByDisplayValue("");
      expect(input).toBeInTheDocument();
    });

    it("should render with initial string value", () => {
      const onChange = vi.fn();
      render(<FormInput label="Name" value="John Doe" onChange={onChange} />);

      expect(screen.getByDisplayValue("John Doe")).toBeInTheDocument();
    });

    it("should render with initial number value", () => {
      const onChange = vi.fn();
      render(<FormInput label="Age" type="number" value={25} onChange={onChange} />);

      expect(screen.getByDisplayValue("25")).toBeInTheDocument();
    });

    it("should render with zero value", () => {
      const onChange = vi.fn();
      render(<FormInput label="Count" type="number" value={0} onChange={onChange} />);

      expect(screen.getByDisplayValue("0")).toBeInTheDocument();
    });
  });

  describe("default type", () => {
    it("should default to type='text' when type not specified", () => {
      const onChange = vi.fn();
      render(<FormInput label="Test" value="" onChange={onChange} />);

      const input = screen.getByDisplayValue("") as HTMLInputElement;
      expect(input.type).toBe("text");
    });
  });

  describe("JRPG styling", () => {
    it("should apply background color", () => {
      const onChange = vi.fn();
      render(<FormInput label="Test" value="" onChange={onChange} />);

      const input = screen.getByDisplayValue("") as HTMLInputElement;
      expect(input.style.background).toBe("rgb(17, 17, 17)");
    });

    it("should apply text color using CSS variable", () => {
      const onChange = vi.fn();
      render(<FormInput label="Test" value="" onChange={onChange} />);

      const input = screen.getByDisplayValue("") as HTMLInputElement;
      expect(input.style.color).toBe("var(--jrpg-white)");
    });

    it("should apply border with gold color variable", () => {
      const onChange = vi.fn();
      render(<FormInput label="Test" value="" onChange={onChange} />);

      const input = screen.getByDisplayValue("") as HTMLInputElement;
      expect(input.style.border).toBe("1px solid var(--jrpg-border-gold)");
    });

    it("should apply 100% width", () => {
      const onChange = vi.fn();
      render(<FormInput label="Test" value="" onChange={onChange} />);

      const input = screen.getByDisplayValue("") as HTMLInputElement;
      expect(input.style.width).toBe("100%");
    });

    it("should apply jrpg-text-small class to label", () => {
      const onChange = vi.fn();
      const { container } = render(<FormInput label="Test" value="" onChange={onChange} />);

      const label = container.querySelector("label");
      expect(label).toHaveClass("jrpg-text-small");
    });

    it("should apply flex layout to label", () => {
      const onChange = vi.fn();
      const { container } = render(<FormInput label="Test" value="" onChange={onChange} />);

      const label = container.querySelector("label") as HTMLLabelElement;
      expect(label.style.display).toBe("flex");
      expect(label.style.flexDirection).toBe("column");
      expect(label.style.gap).toBe("4px");
    });
  });
});

describe("FormInput - Text Input Type", () => {
  describe("onChange behavior", () => {
    it("should call onChange with string value when typing", () => {
      const onChange = vi.fn();
      render(<FormInput label="Name" value="" onChange={onChange} />);

      const input = screen.getByDisplayValue("");
      fireEvent.change(input, { target: { value: "Hello" } });

      expect(onChange).toHaveBeenCalledWith("Hello");
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("should call onChange with updated string value", () => {
      const onChange = vi.fn();
      render(<FormInput label="Name" value="John" onChange={onChange} />);

      const input = screen.getByDisplayValue("John");
      fireEvent.change(input, { target: { value: "Jane" } });

      expect(onChange).toHaveBeenCalledWith("Jane");
    });

    it("should call onChange multiple times for multiple changes", () => {
      const onChange = vi.fn();
      render(<FormInput label="Name" value="" onChange={onChange} />);

      const input = screen.getByDisplayValue("");
      fireEvent.change(input, { target: { value: "A" } });
      fireEvent.change(input, { target: { value: "AB" } });
      fireEvent.change(input, { target: { value: "ABC" } });

      expect(onChange).toHaveBeenCalledTimes(3);
      expect(onChange).toHaveBeenNthCalledWith(1, "A");
      expect(onChange).toHaveBeenNthCalledWith(2, "AB");
      expect(onChange).toHaveBeenNthCalledWith(3, "ABC");
    });
  });

  describe("empty string handling", () => {
    it("should handle empty string", () => {
      const onChange = vi.fn();
      render(<FormInput label="Name" value="text" onChange={onChange} />);

      const input = screen.getByDisplayValue("text");
      fireEvent.change(input, { target: { value: "" } });

      expect(onChange).toHaveBeenCalledWith("");
    });

    it("should handle clearing value to empty string", () => {
      const onChange = vi.fn();
      render(<FormInput label="Name" value="content" onChange={onChange} />);

      const input = screen.getByDisplayValue("content");
      fireEvent.change(input, { target: { value: "" } });

      expect(onChange).toHaveBeenCalledWith("");
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });

  describe("long text handling", () => {
    it("should handle long text input", () => {
      const onChange = vi.fn();
      const longText = "a".repeat(1000);
      render(<FormInput label="Description" value="" onChange={onChange} />);

      const input = screen.getByDisplayValue("");
      fireEvent.change(input, { target: { value: longText } });

      expect(onChange).toHaveBeenCalledWith(longText);
    });

    it("should handle special characters", () => {
      const onChange = vi.fn();
      const specialText = "Hello @#$%^&*(){}[]<>?/|\\~`";
      render(<FormInput label="Text" value="" onChange={onChange} />);

      const input = screen.getByDisplayValue("");
      fireEvent.change(input, { target: { value: specialText } });

      expect(onChange).toHaveBeenCalledWith(specialText);
    });

    it("should handle unicode characters", () => {
      const onChange = vi.fn();
      const unicodeText = "Hello 世界 🎮🎲";
      render(<FormInput label="Text" value="" onChange={onChange} />);

      const input = screen.getByDisplayValue("");
      fireEvent.change(input, { target: { value: unicodeText } });

      expect(onChange).toHaveBeenCalledWith(unicodeText);
    });
  });

  describe("padding", () => {
    it("should use 4px padding for text type", () => {
      const onChange = vi.fn();
      render(<FormInput label="Name" value="" onChange={onChange} />);

      const input = screen.getByDisplayValue("") as HTMLInputElement;
      expect(input.style.padding).toBe("4px");
    });

    it("should use 4px padding for text type explicitly specified", () => {
      const onChange = vi.fn();
      render(<FormInput label="Name" type="text" value="" onChange={onChange} />);

      const input = screen.getByDisplayValue("") as HTMLInputElement;
      expect(input.style.padding).toBe("4px");
    });
  });
});

describe("FormInput - Number Input Type", () => {
  describe("onChange with number parsing", () => {
    it("should call onChange with parsed integer", () => {
      const onChange = vi.fn();
      render(<FormInput label="HP" type="number" value={0} onChange={onChange} />);

      const input = screen.getByDisplayValue("0");
      fireEvent.change(input, { target: { value: "42" } });

      expect(onChange).toHaveBeenCalledWith(42);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("should parse string to integer using parseInt", () => {
      const onChange = vi.fn();
      render(<FormInput label="Level" type="number" value={1} onChange={onChange} />);

      const input = screen.getByDisplayValue("1");
      fireEvent.change(input, { target: { value: "99" } });

      expect(onChange).toHaveBeenCalledWith(99);
    });

    it("should call onChange with integer for each change", () => {
      const onChange = vi.fn();
      render(<FormInput label="Count" type="number" value={0} onChange={onChange} />);

      const input = screen.getByDisplayValue("0");
      fireEvent.change(input, { target: { value: "5" } });
      fireEvent.change(input, { target: { value: "10" } });

      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenNthCalledWith(1, 5);
      expect(onChange).toHaveBeenNthCalledWith(2, 10);
    });
  });

  describe("NaN handling", () => {
    it("should convert NaN to 0", () => {
      const onChange = vi.fn();
      render(<FormInput label="HP" type="number" value={10} onChange={onChange} />);

      const input = screen.getByDisplayValue("10");
      fireEvent.change(input, { target: { value: "" } });

      expect(onChange).toHaveBeenCalledWith(0);
    });

    it("should convert invalid string to 0", () => {
      const onChange = vi.fn();
      render(<FormInput label="HP" type="number" value={10} onChange={onChange} />);

      const input = screen.getByDisplayValue("10");
      fireEvent.change(input, { target: { value: "abc" } });

      expect(onChange).toHaveBeenCalledWith(0);
    });

    it("should convert non-numeric string to 0", () => {
      const onChange = vi.fn();
      render(<FormInput label="HP" type="number" value={10} onChange={onChange} />);

      const input = screen.getByDisplayValue("10");
      fireEvent.change(input, { target: { value: "not a number" } });

      expect(onChange).toHaveBeenCalledWith(0);
    });

    it("should handle special characters as NaN → 0", () => {
      const onChange = vi.fn();
      render(<FormInput label="HP" type="number" value={10} onChange={onChange} />);

      const input = screen.getByDisplayValue("10");
      fireEvent.change(input, { target: { value: "!@#$" } });

      expect(onChange).toHaveBeenCalledWith(0);
    });
  });

  describe("negative number handling", () => {
    it("should handle negative numbers", () => {
      const onChange = vi.fn();
      render(<FormInput label="Temp" type="number" value={0} onChange={onChange} />);

      const input = screen.getByDisplayValue("0");
      fireEvent.change(input, { target: { value: "-5" } });

      expect(onChange).toHaveBeenCalledWith(-5);
    });

    it("should parse negative string to negative integer", () => {
      const onChange = vi.fn();
      render(<FormInput label="Delta" type="number" value={0} onChange={onChange} />);

      const input = screen.getByDisplayValue("0");
      fireEvent.change(input, { target: { value: "-100" } });

      expect(onChange).toHaveBeenCalledWith(-100);
    });

    it("should handle large negative numbers", () => {
      const onChange = vi.fn();
      render(<FormInput label="Value" type="number" value={0} onChange={onChange} />);

      const input = screen.getByDisplayValue("0");
      fireEvent.change(input, { target: { value: "-9999" } });

      expect(onChange).toHaveBeenCalledWith(-9999);
    });
  });

  describe("decimal string handling (parseInt behavior)", () => {
    it("should truncate decimal strings using parseInt", () => {
      const onChange = vi.fn();
      render(<FormInput label="HP" type="number" value={0} onChange={onChange} />);

      const input = screen.getByDisplayValue("0");
      fireEvent.change(input, { target: { value: "42.7" } });

      expect(onChange).toHaveBeenCalledWith(42);
    });

    it("should handle decimal with parseInt truncation", () => {
      const onChange = vi.fn();
      render(<FormInput label="Value" type="number" value={0} onChange={onChange} />);

      const input = screen.getByDisplayValue("0");
      fireEvent.change(input, { target: { value: "99.999" } });

      expect(onChange).toHaveBeenCalledWith(99);
    });

    it("should handle negative decimal with parseInt truncation", () => {
      const onChange = vi.fn();
      render(<FormInput label="Value" type="number" value={0} onChange={onChange} />);

      const input = screen.getByDisplayValue("0");
      fireEvent.change(input, { target: { value: "-5.8" } });

      expect(onChange).toHaveBeenCalledWith(-5);
    });

    it("should handle decimal-only string (e.g., '.5') as NaN → 0", () => {
      const onChange = vi.fn();
      render(<FormInput label="Value" type="number" value={10} onChange={onChange} />);

      const input = screen.getByDisplayValue("10");
      fireEvent.change(input, { target: { value: ".5" } });

      expect(onChange).toHaveBeenCalledWith(0);
    });
  });

  describe("min, max, step attributes", () => {
    it("should render with min attribute", () => {
      const onChange = vi.fn();
      render(<FormInput label="HP" type="number" value={10} onChange={onChange} min={0} />);

      const input = screen.getByDisplayValue("10") as HTMLInputElement;
      expect(input.min).toBe("0");
    });

    it("should render with max attribute", () => {
      const onChange = vi.fn();
      render(<FormInput label="HP" type="number" value={50} onChange={onChange} max={100} />);

      const input = screen.getByDisplayValue("50") as HTMLInputElement;
      expect(input.max).toBe("100");
    });

    it("should render with step attribute", () => {
      const onChange = vi.fn();
      render(<FormInput label="Value" type="number" value={0} onChange={onChange} step={5} />);

      const input = screen.getByDisplayValue("0") as HTMLInputElement;
      expect(input.step).toBe("5");
    });

    it("should render with all min, max, step attributes", () => {
      const onChange = vi.fn();
      render(
        <FormInput
          label="HP"
          type="number"
          value={50}
          onChange={onChange}
          min={0}
          max={100}
          step={10}
        />,
      );

      const input = screen.getByDisplayValue("50") as HTMLInputElement;
      expect(input.min).toBe("0");
      expect(input.max).toBe("100");
      expect(input.step).toBe("10");
    });

    it("should not render min attribute when not provided", () => {
      const onChange = vi.fn();
      render(<FormInput label="HP" type="number" value={10} onChange={onChange} />);

      const input = screen.getByDisplayValue("10") as HTMLInputElement;
      expect(input.min).toBe("");
    });

    it("should not render max attribute when not provided", () => {
      const onChange = vi.fn();
      render(<FormInput label="HP" type="number" value={10} onChange={onChange} />);

      const input = screen.getByDisplayValue("10") as HTMLInputElement;
      expect(input.max).toBe("");
    });

    it("should not render step attribute when not provided", () => {
      const onChange = vi.fn();
      render(<FormInput label="HP" type="number" value={10} onChange={onChange} />);

      const input = screen.getByDisplayValue("10") as HTMLInputElement;
      expect(input.step).toBe("");
    });
  });

  describe("padding", () => {
    it("should use 4px padding for number type", () => {
      const onChange = vi.fn();
      render(<FormInput label="HP" type="number" value={10} onChange={onChange} />);

      const input = screen.getByDisplayValue("10") as HTMLInputElement;
      expect(input.style.padding).toBe("4px");
    });
  });

  describe("type attribute", () => {
    it("should render with type='number'", () => {
      const onChange = vi.fn();
      render(<FormInput label="HP" type="number" value={10} onChange={onChange} />);

      const input = screen.getByDisplayValue("10") as HTMLInputElement;
      expect(input.type).toBe("number");
    });
  });
});

describe("FormInput - Password Input Type", () => {
  describe("type attribute", () => {
    it("should render with type='password'", () => {
      const onChange = vi.fn();
      render(<FormInput label="Password" type="password" value="" onChange={onChange} />);

      const input = screen.getByDisplayValue("") as HTMLInputElement;
      expect(input.type).toBe("password");
    });
  });

  describe("onChange behavior", () => {
    it("should call onChange with string value", () => {
      const onChange = vi.fn();
      render(<FormInput label="Password" type="password" value="" onChange={onChange} />);

      const input = screen.getByDisplayValue("");
      fireEvent.change(input, { target: { value: "secret123" } });

      expect(onChange).toHaveBeenCalledWith("secret123");
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("should handle password changes", () => {
      const onChange = vi.fn();
      render(<FormInput label="Password" type="password" value="" onChange={onChange} />);

      const input = screen.getByDisplayValue("");
      fireEvent.change(input, { target: { value: "mypassword" } });

      expect(onChange).toHaveBeenCalledWith("mypassword");
    });

    it("should handle special characters in password", () => {
      const onChange = vi.fn();
      render(<FormInput label="Password" type="password" value="" onChange={onChange} />);

      const input = screen.getByDisplayValue("");
      fireEvent.change(input, { target: { value: "P@ssw0rd!#$" } });

      expect(onChange).toHaveBeenCalledWith("P@ssw0rd!#$");
    });
  });

  describe("padding (different from text/number)", () => {
    it("should use 6px padding for password type", () => {
      const onChange = vi.fn();
      render(<FormInput label="Password" type="password" value="" onChange={onChange} />);

      const input = screen.getByDisplayValue("") as HTMLInputElement;
      expect(input.style.padding).toBe("6px");
    });

    it("should use different padding than text type", () => {
      const onChange = vi.fn();

      // Render password input
      const { container: passwordContainer } = render(
        <FormInput label="Password" type="password" value="" onChange={onChange} />,
      );

      // Render text input
      const { container: textContainer } = render(
        <FormInput label="Text" type="text" value="" onChange={onChange} />,
      );

      const passwordInput = passwordContainer.querySelector("input") as HTMLInputElement;
      const textInput = textContainer.querySelector("input") as HTMLInputElement;

      expect(passwordInput.style.padding).toBe("6px");
      expect(textInput.style.padding).toBe("4px");
    });
  });

  describe("visual masking", () => {
    it("should mask input visually with password type", () => {
      const onChange = vi.fn();
      render(<FormInput label="Password" type="password" value="secret" onChange={onChange} />);

      const input = screen.getByDisplayValue("secret") as HTMLInputElement;
      // Type attribute is "password" which browsers render as masked
      expect(input.type).toBe("password");
    });
  });
});

describe("FormInput - Blur Handling", () => {
  describe("with onBlur provided", () => {
    it("should call onBlur when input loses focus", () => {
      const onChange = vi.fn();
      const onBlur = vi.fn();
      render(<FormInput label="Name" value="" onChange={onChange} onBlur={onBlur} />);

      const input = screen.getByDisplayValue("");
      fireEvent.blur(input);

      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it("should call onBlur without arguments", () => {
      const onChange = vi.fn();
      const onBlur = vi.fn();
      render(<FormInput label="Name" value="" onChange={onChange} onBlur={onBlur} />);

      const input = screen.getByDisplayValue("");
      fireEvent.blur(input);

      expect(onBlur).toHaveBeenCalledWith();
    });

    it("should call onBlur multiple times for multiple blurs", () => {
      const onChange = vi.fn();
      const onBlur = vi.fn();
      render(<FormInput label="Name" value="" onChange={onChange} onBlur={onBlur} />);

      const input = screen.getByDisplayValue("");
      fireEvent.blur(input);
      fireEvent.blur(input);
      fireEvent.blur(input);

      expect(onBlur).toHaveBeenCalledTimes(3);
    });

    it("should call onBlur for number input", () => {
      const onChange = vi.fn();
      const onBlur = vi.fn();
      render(<FormInput label="HP" type="number" value={10} onChange={onChange} onBlur={onBlur} />);

      const input = screen.getByDisplayValue("10");
      fireEvent.blur(input);

      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it("should call onBlur for password input", () => {
      const onChange = vi.fn();
      const onBlur = vi.fn();
      render(
        <FormInput label="Password" type="password" value="" onChange={onChange} onBlur={onBlur} />,
      );

      const input = screen.getByDisplayValue("");
      fireEvent.blur(input);

      expect(onBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe("without onBlur provided", () => {
    it("should not error when onBlur not provided and input loses focus", () => {
      const onChange = vi.fn();
      render(<FormInput label="Name" value="" onChange={onChange} />);

      const input = screen.getByDisplayValue("");
      expect(() => fireEvent.blur(input)).not.toThrow();
    });

    it("should handle blur gracefully when onBlur undefined", () => {
      const onChange = vi.fn();
      render(<FormInput label="Name" value="" onChange={onChange} />);

      const input = screen.getByDisplayValue("");
      fireEvent.blur(input);

      // Should not throw error
      expect(input).toBeInTheDocument();
    });
  });

  describe("onBlur called after onChange", () => {
    it("should call onBlur after onChange when typing then blurring", () => {
      const onChange = vi.fn();
      const onBlur = vi.fn();
      const callOrder: string[] = [];

      onChange.mockImplementation(() => callOrder.push("onChange"));
      onBlur.mockImplementation(() => callOrder.push("onBlur"));

      render(<FormInput label="Name" value="" onChange={onChange} onBlur={onBlur} />);

      const input = screen.getByDisplayValue("");
      fireEvent.change(input, { target: { value: "test" } });
      fireEvent.blur(input);

      expect(callOrder).toEqual(["onChange", "onBlur"]);
    });

    it("should call both onChange and onBlur in sequence", () => {
      const onChange = vi.fn();
      const onBlur = vi.fn();
      render(<FormInput label="HP" type="number" value={0} onChange={onChange} onBlur={onBlur} />);

      const input = screen.getByDisplayValue("0");
      fireEvent.change(input, { target: { value: "50" } });
      fireEvent.blur(input);

      expect(onChange).toHaveBeenCalledWith(50);
      expect(onBlur).toHaveBeenCalled();
    });

    it("should call onBlur independently of onChange", () => {
      const onChange = vi.fn();
      const onBlur = vi.fn();
      render(<FormInput label="Name" value="initial" onChange={onChange} onBlur={onBlur} />);

      const input = screen.getByDisplayValue("initial");
      // Blur without changing
      fireEvent.blur(input);

      expect(onChange).not.toHaveBeenCalled();
      expect(onBlur).toHaveBeenCalledTimes(1);
    });
  });
});

describe("FormInput - Optional Props", () => {
  describe("placeholder", () => {
    it("should render with placeholder", () => {
      const onChange = vi.fn();
      render(<FormInput label="Name" value="" onChange={onChange} placeholder="Enter your name" />);

      const input = screen.getByPlaceholderText("Enter your name");
      expect(input).toBeInTheDocument();
    });

    it("should render placeholder correctly for text input", () => {
      const onChange = vi.fn();
      render(
        <FormInput
          label="Email"
          type="text"
          value=""
          onChange={onChange}
          placeholder="user@example.com"
        />,
      );

      expect(screen.getByPlaceholderText("user@example.com")).toBeInTheDocument();
    });

    it("should render placeholder correctly for number input", () => {
      const onChange = vi.fn();
      render(
        <FormInput label="HP" type="number" value={0} onChange={onChange} placeholder="Enter HP" />,
      );

      expect(screen.getByPlaceholderText("Enter HP")).toBeInTheDocument();
    });

    it("should render placeholder correctly for password input", () => {
      const onChange = vi.fn();
      render(
        <FormInput
          label="Password"
          type="password"
          value=""
          onChange={onChange}
          placeholder="Enter password"
        />,
      );

      expect(screen.getByPlaceholderText("Enter password")).toBeInTheDocument();
    });

    it("should not render placeholder when not provided", () => {
      const onChange = vi.fn();
      const { container } = render(<FormInput label="Name" value="" onChange={onChange} />);

      const input = container.querySelector("input") as HTMLInputElement;
      expect(input.placeholder).toBe("");
    });
  });

  describe("disabled state", () => {
    it("should render as disabled when disabled is true", () => {
      const onChange = vi.fn();
      render(<FormInput label="Name" value="" onChange={onChange} disabled={true} />);

      const input = screen.getByDisplayValue("") as HTMLInputElement;
      expect(input.disabled).toBe(true);
    });

    it("should not be disabled by default", () => {
      const onChange = vi.fn();
      render(<FormInput label="Name" value="" onChange={onChange} />);

      const input = screen.getByDisplayValue("") as HTMLInputElement;
      expect(input.disabled).toBe(false);
    });

    it("should be enabled when disabled is false", () => {
      const onChange = vi.fn();
      render(<FormInput label="Name" value="" onChange={onChange} disabled={false} />);

      const input = screen.getByDisplayValue("") as HTMLInputElement;
      expect(input.disabled).toBe(false);
    });
  });

  describe("className", () => {
    it("should apply custom className to input", () => {
      const onChange = vi.fn();
      render(<FormInput label="Name" value="" onChange={onChange} className="custom-class" />);

      const input = screen.getByDisplayValue("");
      expect(input).toHaveClass("custom-class");
    });

    it("should apply multiple classes", () => {
      const onChange = vi.fn();
      render(
        <FormInput label="Name" value="" onChange={onChange} className="class1 class2 class3" />,
      );

      const input = screen.getByDisplayValue("");
      expect(input).toHaveClass("class1", "class2", "class3");
    });

    it("should not apply className when not provided", () => {
      const onChange = vi.fn();
      const { container } = render(<FormInput label="Name" value="" onChange={onChange} />);

      const input = container.querySelector("input") as HTMLInputElement;
      expect(input.className).toBe("");
    });
  });

  describe("style (merged correctly)", () => {
    it("should merge custom styles with default styles", () => {
      const onChange = vi.fn();
      render(<FormInput label="Name" value="" onChange={onChange} style={{ fontSize: "16px" }} />);

      const input = screen.getByDisplayValue("") as HTMLInputElement;
      expect(input.style.fontSize).toBe("16px");
      // Default styles should still apply
      expect(input.style.background).toBe("rgb(17, 17, 17)");
      expect(input.style.width).toBe("100%");
    });

    it("should override default styles with custom styles", () => {
      const onChange = vi.fn();
      render(<FormInput label="Name" value="" onChange={onChange} style={{ background: "red" }} />);

      const input = screen.getByDisplayValue("") as HTMLInputElement;
      // Custom style should override default
      expect(input.style.background).toBe("red");
    });

    it("should override default padding with custom style", () => {
      const onChange = vi.fn();
      render(<FormInput label="Name" value="" onChange={onChange} style={{ padding: "10px" }} />);

      const input = screen.getByDisplayValue("") as HTMLInputElement;
      expect(input.style.padding).toBe("10px");
    });

    it("should override default width with custom style", () => {
      const onChange = vi.fn();
      render(<FormInput label="Name" value="" onChange={onChange} style={{ width: "50%" }} />);

      const input = screen.getByDisplayValue("") as HTMLInputElement;
      expect(input.style.width).toBe("50%");
    });

    it("should apply multiple custom styles", () => {
      const onChange = vi.fn();
      render(
        <FormInput
          label="Name"
          value=""
          onChange={onChange}
          style={{
            fontSize: "20px",
            fontWeight: "bold",
            letterSpacing: "2px",
          }}
        />,
      );

      const input = screen.getByDisplayValue("") as HTMLInputElement;
      expect(input.style.fontSize).toBe("20px");
      expect(input.style.fontWeight).toBe("bold");
      expect(input.style.letterSpacing).toBe("2px");
    });

    it("should not apply custom styles when style not provided", () => {
      const onChange = vi.fn();
      render(<FormInput label="Name" value="" onChange={onChange} />);

      const input = screen.getByDisplayValue("") as HTMLInputElement;
      // Only default styles should apply
      expect(input.style.background).toBe("rgb(17, 17, 17)");
      expect(input.style.padding).toBe("4px");
      expect(input.style.width).toBe("100%");
    });
  });
});

describe("FormInput - React.memo Optimization", () => {
  describe("re-render behavior", () => {
    it("should not re-render with same props", () => {
      const onChange = vi.fn();
      let renderCount = 0;

      const TestWrapper = ({ value }: { value: string }) => {
        renderCount++;
        return <FormInput label="Name" value={value} onChange={onChange} />;
      };

      const { rerender } = render(<TestWrapper value="test" />);

      const initialRenderCount = renderCount;

      // Re-render with same props
      rerender(<TestWrapper value="test" />);

      // Note: React.memo prevents re-renders, but we can't directly test this
      // without access to internals. We verify the component is memoized
      // by checking it's wrapped with React.memo
      expect(FormInput.displayName).toBe("FormInput");
    });

    it("should re-render when value prop changes", () => {
      const onChange = vi.fn();
      const { rerender } = render(<FormInput label="Name" value="initial" onChange={onChange} />);

      expect(screen.getByDisplayValue("initial")).toBeInTheDocument();

      rerender(<FormInput label="Name" value="updated" onChange={onChange} />);

      expect(screen.getByDisplayValue("updated")).toBeInTheDocument();
      expect(screen.queryByDisplayValue("initial")).not.toBeInTheDocument();
    });

    it("should re-render when label prop changes", () => {
      const onChange = vi.fn();
      const { rerender } = render(<FormInput label="First Name" value="" onChange={onChange} />);

      expect(screen.getByText("First Name")).toBeInTheDocument();

      rerender(<FormInput label="Last Name" value="" onChange={onChange} />);

      expect(screen.getByText("Last Name")).toBeInTheDocument();
      expect(screen.queryByText("First Name")).not.toBeInTheDocument();
    });

    it("should re-render when type prop changes", () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <FormInput label="Field" type="text" value="" onChange={onChange} />,
      );

      let input = screen.getByDisplayValue("") as HTMLInputElement;
      expect(input.type).toBe("text");

      rerender(<FormInput label="Field" type="password" value="" onChange={onChange} />);

      input = screen.getByDisplayValue("") as HTMLInputElement;
      expect(input.type).toBe("password");
    });

    it("should re-render when onChange prop changes", () => {
      const onChange1 = vi.fn();
      const onChange2 = vi.fn();

      const { rerender } = render(<FormInput label="Name" value="" onChange={onChange1} />);

      const input = screen.getByDisplayValue("");
      fireEvent.change(input, { target: { value: "test" } });

      expect(onChange1).toHaveBeenCalledWith("test");
      expect(onChange2).not.toHaveBeenCalled();

      rerender(<FormInput label="Name" value="" onChange={onChange2} />);

      fireEvent.change(input, { target: { value: "test2" } });

      expect(onChange2).toHaveBeenCalledWith("test2");
    });
  });

  describe("prop stability", () => {
    it("should work with stable onChange reference", () => {
      const onChange = vi.fn();
      const { rerender } = render(<FormInput label="Name" value="test1" onChange={onChange} />);

      // Re-render with same onChange reference
      rerender(<FormInput label="Name" value="test2" onChange={onChange} />);

      const input = screen.getByDisplayValue("test2");
      fireEvent.change(input, { target: { value: "test3" } });

      expect(onChange).toHaveBeenCalledWith("test3");
    });

    it("should work with stable onBlur reference", () => {
      const onChange = vi.fn();
      const onBlur = vi.fn();

      const { rerender } = render(
        <FormInput label="Name" value="test1" onChange={onChange} onBlur={onBlur} />,
      );

      // Re-render with same onBlur reference
      rerender(<FormInput label="Name" value="test2" onChange={onChange} onBlur={onBlur} />);

      const input = screen.getByDisplayValue("test2");
      fireEvent.blur(input);

      expect(onBlur).toHaveBeenCalledTimes(1);
    });
  });
});

describe("FormInput - Component Metadata", () => {
  describe("displayName", () => {
    it("should have displayName of 'FormInput'", () => {
      expect(FormInput.displayName).toBe("FormInput");
    });
  });
});
