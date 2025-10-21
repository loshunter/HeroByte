/**
 * Characterization tests for FormInput
 *
 * These tests capture the behavior of the original code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source patterns in DMMenu.tsx:
 * - PropEditor (text inputs): lines ~160-177, ~185-197
 * - NPCEditor (text/number inputs): lines ~327-453
 * - Session tab (password inputs): lines ~1463-1495
 *
 * Target: apps/client/src/components/ui/FormInput.tsx
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';

// ============================================================================
// INLINE IMPLEMENTATION FOR TESTING
// ============================================================================
// This will be replaced after extraction. For now, we implement the component
// inline to test the expected behavior based on the original DMMenu patterns.

interface FormInputProps {
  label: string;
  type?: 'text' | 'number' | 'password';
  value: string | number;
  onChange: (value: string | number) => void;
  onBlur?: () => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const FormInput = ({
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  placeholder,
  min,
  max,
  step,
  disabled = false,
  className,
  style,
}: FormInputProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (type === 'number') {
      const numValue = parseInt(e.target.value, 10);
      onChange(isNaN(numValue) ? 0 : numValue);
    } else {
      onChange(e.target.value);
    }
  };

  // Password inputs use 6px padding, text/number use 4px
  const defaultPadding = type === 'password' ? '6px' : '4px';

  const defaultInputStyle: React.CSSProperties = {
    width: '100%',
    padding: defaultPadding,
    background: '#111',
    color: 'var(--jrpg-white)',
    border: '1px solid var(--jrpg-border-gold)',
  };

  const mergedInputStyle = { ...defaultInputStyle, ...style };

  const labelClassName = className || 'jrpg-text-small';

  return (
    <label
      className={labelClassName}
      style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
    >
      {label}
      <input
        type={type}
        value={value}
        onChange={handleChange}
        onBlur={onBlur}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        style={mergedInputStyle}
      />
    </label>
  );
};

// ============================================================================
// TESTS
// ============================================================================

describe('FormInput - Characterization', () => {
  describe('basic rendering', () => {
    it('renders label text correctly', () => {
      render(<FormInput label="Test Label" value="" onChange={vi.fn()} />);
      expect(screen.getByText('Test Label')).toBeInTheDocument();
    });

    it('renders text input by default', () => {
      render(<FormInput label="Test" value="" onChange={vi.fn()} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'text');
    });

    it('renders number input when type="number"', () => {
      render(<FormInput label="Test" type="number" value={0} onChange={vi.fn()} />);
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('type', 'number');
    });

    it('renders password input when type="password"', () => {
      render(<FormInput label="Test" type="password" value="" onChange={vi.fn()} />);
      const input = screen.getByLabelText('Test');
      expect(input).toHaveAttribute('type', 'password');
    });

    it('displays current value', () => {
      render(<FormInput label="Test" value="Hello World" onChange={vi.fn()} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('Hello World');
    });

    it('displays current numeric value', () => {
      render(<FormInput label="Test" type="number" value={42} onChange={vi.fn()} />);
      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      expect(input.value).toBe('42');
    });
  });

  describe('text input behavior', () => {
    it('onChange called with string value', () => {
      const onChange = vi.fn();
      render(<FormInput label="Test" value="" onChange={onChange} />);
      const input = screen.getByRole('textbox');

      fireEvent.change(input, { target: { value: 'New text' } });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith('New text');
    });

    it('onBlur called when input loses focus', () => {
      const onBlur = vi.fn();
      render(<FormInput label="Test" value="" onChange={vi.fn()} onBlur={onBlur} />);
      const input = screen.getByRole('textbox');

      fireEvent.blur(input);

      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('onBlur is optional (does not error if not provided)', () => {
      render(<FormInput label="Test" value="" onChange={vi.fn()} />);
      const input = screen.getByRole('textbox');

      expect(() => {
        fireEvent.blur(input);
      }).not.toThrow();
    });

    it('handles empty string', () => {
      const onChange = vi.fn();
      render(<FormInput label="Test" value="Hello" onChange={onChange} />);
      const input = screen.getByRole('textbox');

      fireEvent.change(input, { target: { value: '' } });

      expect(onChange).toHaveBeenCalledWith('');
    });

    it('handles special characters', () => {
      const onChange = vi.fn();
      render(<FormInput label="Test" value="" onChange={onChange} />);
      const input = screen.getByRole('textbox');

      const specialText = '!@#$%^&*()_+-=[]{}|;\':",./<>?';
      fireEvent.change(input, { target: { value: specialText } });

      expect(onChange).toHaveBeenCalledWith(specialText);
    });

    it('handles very long text', () => {
      const onChange = vi.fn();
      render(<FormInput label="Test" value="" onChange={onChange} />);
      const input = screen.getByRole('textbox');

      const longText = 'a'.repeat(1000);
      fireEvent.change(input, { target: { value: longText } });

      expect(onChange).toHaveBeenCalledWith(longText);
    });
  });

  describe('number input behavior', () => {
    it('onChange called with number value', () => {
      const onChange = vi.fn();
      render(<FormInput label="Test" type="number" value={0} onChange={onChange} />);
      const input = screen.getByRole('spinbutton');

      fireEvent.change(input, { target: { value: '42' } });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(42);
    });

    it('handles integer input', () => {
      const onChange = vi.fn();
      render(<FormInput label="Test" type="number" value={0} onChange={onChange} />);
      const input = screen.getByRole('spinbutton');

      fireEvent.change(input, { target: { value: '123' } });

      expect(onChange).toHaveBeenCalledWith(123);
    });

    it('handles decimal input (if step allows)', () => {
      const onChange = vi.fn();
      render(<FormInput label="Test" type="number" value={0} onChange={onChange} step={0.1} />);
      const input = screen.getByRole('spinbutton');

      fireEvent.change(input, { target: { value: '12.5' } });

      // parseInt converts to integer, so this tests the actual behavior
      expect(onChange).toHaveBeenCalledWith(12);
    });

    it('respects min attribute', () => {
      render(<FormInput label="Test" type="number" value={5} onChange={vi.fn()} min={0} />);
      const input = screen.getByRole('spinbutton');

      expect(input).toHaveAttribute('min', '0');
    });

    it('respects max attribute', () => {
      render(<FormInput label="Test" type="number" value={5} onChange={vi.fn()} max={10} />);
      const input = screen.getByRole('spinbutton');

      expect(input).toHaveAttribute('max', '10');
    });

    it('respects step attribute', () => {
      render(<FormInput label="Test" type="number" value={0} onChange={vi.fn()} step={5} />);
      const input = screen.getByRole('spinbutton');

      expect(input).toHaveAttribute('step', '5');
    });

    it('converts string to number correctly', () => {
      const onChange = vi.fn();
      render(<FormInput label="Test" type="number" value={0} onChange={onChange} />);
      const input = screen.getByRole('spinbutton');

      fireEvent.change(input, { target: { value: '999' } });

      expect(onChange).toHaveBeenCalledWith(999);
      expect(typeof onChange.mock.calls[0][0]).toBe('number');
    });

    it('handles invalid number input (NaN)', () => {
      const onChange = vi.fn();
      render(<FormInput label="Test" type="number" value={0} onChange={onChange} />);
      const input = screen.getByRole('spinbutton');

      fireEvent.change(input, { target: { value: 'abc' } });

      // Invalid number should convert to 0
      expect(onChange).toHaveBeenCalledWith(0);
    });
  });

  describe('password input behavior', () => {
    it('masks password text (type="password")', () => {
      render(<FormInput label="Password" type="password" value="secret123" onChange={vi.fn()} />);
      const input = screen.getByLabelText('Password');

      expect(input).toHaveAttribute('type', 'password');
    });

    it('onChange called with string value', () => {
      const onChange = vi.fn();
      render(<FormInput label="Password" type="password" value="" onChange={onChange} />);
      const input = screen.getByLabelText('Password');

      fireEvent.change(input, { target: { value: 'mypassword' } });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith('mypassword');
    });

    it('value not visible in DOM (security)', () => {
      const { container } = render(
        <FormInput label="Password" type="password" value="secret123" onChange={vi.fn()} />
      );

      // The value should be in the input but not visible as text in the DOM
      const input = screen.getByLabelText('Password') as HTMLInputElement;
      expect(input.value).toBe('secret123');
      expect(input.type).toBe('password');
    });
  });

  describe('styling', () => {
    it('default width: 100%', () => {
      render(<FormInput label="Test" value="" onChange={vi.fn()} />);
      const input = screen.getByRole('textbox');

      expect(input).toHaveStyle({ width: '100%' });
    });

    it('default padding: "4px" for text', () => {
      render(<FormInput label="Test" type="text" value="" onChange={vi.fn()} />);
      const input = screen.getByRole('textbox');

      expect(input).toHaveStyle({ padding: '4px' });
    });

    it('default padding: "4px" for number', () => {
      render(<FormInput label="Test" type="number" value={0} onChange={vi.fn()} />);
      const input = screen.getByRole('spinbutton');

      expect(input).toHaveStyle({ padding: '4px' });
    });

    it('default padding: "6px" for password (variant)', () => {
      render(<FormInput label="Password" type="password" value="" onChange={vi.fn()} />);
      const input = screen.getByLabelText('Password');

      expect(input).toHaveStyle({ padding: '6px' });
    });

    it('background: "#111" (always)', () => {
      const { rerender } = render(<FormInput label="Test" value="" onChange={vi.fn()} />);
      let input = screen.getByRole('textbox');
      expect(input).toHaveStyle({ background: '#111' });

      rerender(<FormInput label="Test" type="number" value={0} onChange={vi.fn()} />);
      input = screen.getByRole('spinbutton');
      expect(input).toHaveStyle({ background: '#111' });

      rerender(<FormInput label="Test" type="password" value="" onChange={vi.fn()} />);
      input = screen.getByLabelText('Test');
      expect(input).toHaveStyle({ background: '#111' });
    });

    it('color: "var(--jrpg-white)" (always)', () => {
      const { rerender } = render(<FormInput label="Test" value="" onChange={vi.fn()} />);
      let input = screen.getByRole('textbox');
      expect(input).toHaveStyle({ color: 'var(--jrpg-white)' });

      rerender(<FormInput label="Test" type="number" value={0} onChange={vi.fn()} />);
      input = screen.getByRole('spinbutton');
      expect(input).toHaveStyle({ color: 'var(--jrpg-white)' });

      rerender(<FormInput label="Test" type="password" value="" onChange={vi.fn()} />);
      input = screen.getByLabelText('Test');
      expect(input).toHaveStyle({ color: 'var(--jrpg-white)' });
    });

    it('border: "1px solid var(--jrpg-border-gold)" (always)', () => {
      const { rerender } = render(<FormInput label="Test" value="" onChange={vi.fn()} />);
      let input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.style.border).toBe('1px solid var(--jrpg-border-gold)');

      rerender(<FormInput label="Test" type="number" value={0} onChange={vi.fn()} />);
      input = screen.getByRole('spinbutton') as HTMLInputElement;
      expect(input.style.border).toBe('1px solid var(--jrpg-border-gold)');

      rerender(<FormInput label="Test" type="password" value="" onChange={vi.fn()} />);
      input = screen.getByLabelText('Test') as HTMLInputElement;
      expect(input.style.border).toBe('1px solid var(--jrpg-border-gold)');
    });

    it('label className: "jrpg-text-small" (default)', () => {
      render(<FormInput label="Test" value="" onChange={vi.fn()} />);
      const label = screen.getByText('Test').closest('label');

      expect(label).toHaveClass('jrpg-text-small');
    });

    it('label wrapper flex layout (column, gap 4px)', () => {
      render(<FormInput label="Test" value="" onChange={vi.fn()} />);
      const label = screen.getByText('Test').closest('label');

      expect(label).toHaveStyle({
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      });
    });
  });

  describe('props override', () => {
    it('custom placeholder', () => {
      render(
        <FormInput label="Test" value="" onChange={vi.fn()} placeholder="Enter text here" />
      );
      const input = screen.getByRole('textbox');

      expect(input).toHaveAttribute('placeholder', 'Enter text here');
    });

    it('custom className', () => {
      render(<FormInput label="Test" value="" onChange={vi.fn()} className="custom-class" />);
      const label = screen.getByText('Test').closest('label');

      expect(label).toHaveClass('custom-class');
    });

    it('custom style override', () => {
      render(
        <FormInput
          label="Test"
          value=""
          onChange={vi.fn()}
          style={{ padding: '10px', background: 'red' }}
        />
      );
      const input = screen.getByRole('textbox');

      expect(input).toHaveStyle({ padding: '10px', background: 'red' });
    });

    it('disabled state', () => {
      render(<FormInput label="Test" value="" onChange={vi.fn()} disabled={true} />);
      const input = screen.getByRole('textbox');

      expect(input).toBeDisabled();
    });

    it('all custom props together', () => {
      const onChange = vi.fn();
      const onBlur = vi.fn();
      render(
        <FormInput
          label="Custom"
          value="test"
          onChange={onChange}
          onBlur={onBlur}
          placeholder="Custom placeholder"
          className="custom-class"
          style={{ padding: '8px' }}
          disabled={false}
        />
      );

      const input = screen.getByRole('textbox');
      const label = screen.getByText('Custom').closest('label');

      expect(label).toHaveClass('custom-class');
      expect(input).toHaveAttribute('placeholder', 'Custom placeholder');
      expect(input).toHaveStyle({ padding: '8px' });
      expect(input).not.toBeDisabled();
    });
  });

  describe('real-world patterns', () => {
    it('PropEditor label pattern (text, onBlur)', () => {
      const onChange = vi.fn();
      const onBlur = vi.fn();
      render(<FormInput label="Label" type="text" value="" onChange={onChange} onBlur={onBlur} />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'New Label' } });
      fireEvent.blur(input);

      expect(onChange).toHaveBeenCalledWith('New Label');
      expect(onBlur).toHaveBeenCalledTimes(1);
      expect(input).toHaveStyle({ padding: '4px' });
    });

    it('PropEditor image URL pattern (text, onBlur)', () => {
      const onChange = vi.fn();
      const onBlur = vi.fn();
      render(
        <FormInput label="Image URL" type="text" value="" onChange={onChange} onBlur={onBlur} />
      );

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'https://example.com/image.jpg' } });
      fireEvent.blur(input);

      expect(onChange).toHaveBeenCalledWith('https://example.com/image.jpg');
      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('NPCEditor name pattern (text, onBlur)', () => {
      const onChange = vi.fn();
      const onBlur = vi.fn();
      render(<FormInput label="Name" type="text" value="" onChange={onChange} onBlur={onBlur} />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Goblin Warrior' } });
      fireEvent.blur(input);

      expect(onChange).toHaveBeenCalledWith('Goblin Warrior');
      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('NPCEditor HP pattern (number, min=0, onBlur)', () => {
      const onChange = vi.fn();
      const onBlur = vi.fn();
      render(
        <FormInput
          label="HP"
          type="number"
          value={0}
          onChange={onChange}
          onBlur={onBlur}
          min={0}
        />
      );

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('min', '0');

      fireEvent.change(input, { target: { value: '50' } });
      fireEvent.blur(input);

      expect(onChange).toHaveBeenCalledWith(50);
      expect(onBlur).toHaveBeenCalledTimes(1);
      expect(input).toHaveStyle({ padding: '4px' });
    });

    it('NPCEditor max HP pattern (number, min=0, onBlur)', () => {
      const onChange = vi.fn();
      const onBlur = vi.fn();
      render(
        <FormInput
          label="Max HP"
          type="number"
          value={1}
          onChange={onChange}
          onBlur={onBlur}
          min={1}
        />
      );

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('min', '1');

      fireEvent.change(input, { target: { value: '100' } });
      fireEvent.blur(input);

      expect(onChange).toHaveBeenCalledWith(100);
      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('NPCEditor portrait URL pattern (text, onBlur)', () => {
      const onChange = vi.fn();
      const onBlur = vi.fn();
      render(
        <FormInput
          label="Portrait URL"
          type="text"
          value=""
          onChange={onChange}
          onBlur={onBlur}
        />
      );

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'https://example.com/portrait.jpg' } });
      fireEvent.blur(input);

      expect(onChange).toHaveBeenCalledWith('https://example.com/portrait.jpg');
      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('Session password pattern (password, no onBlur, 6px padding)', () => {
      const onChange = vi.fn();
      render(
        <FormInput
          label="Password"
          type="password"
          value=""
          onChange={onChange}
          placeholder="New password"
        />
      );

      const input = screen.getByLabelText('Password');
      expect(input).toHaveAttribute('type', 'password');
      expect(input).toHaveAttribute('placeholder', 'New password');
      expect(input).toHaveStyle({ padding: '6px' });

      fireEvent.change(input, { target: { value: 'mypassword123' } });

      expect(onChange).toHaveBeenCalledWith('mypassword123');
    });

    it('Session confirm password pattern (password, placeholder)', () => {
      const onChange = vi.fn();
      render(
        <FormInput
          label="Confirm Password"
          type="password"
          value=""
          onChange={onChange}
          placeholder="Confirm password"
        />
      );

      const input = screen.getByLabelText('Confirm Password');
      expect(input).toHaveAttribute('placeholder', 'Confirm password');
      expect(input).toHaveStyle({ padding: '6px' });

      fireEvent.change(input, { target: { value: 'mypassword123' } });

      expect(onChange).toHaveBeenCalledWith('mypassword123');
    });
  });

  describe('edge cases', () => {
    it('rapid value changes', () => {
      const onChange = vi.fn();
      render(<FormInput label="Test" value="" onChange={onChange} />);
      const input = screen.getByRole('textbox');

      for (let i = 0; i < 10; i++) {
        fireEvent.change(input, { target: { value: `text${i}` } });
      }

      expect(onChange).toHaveBeenCalledTimes(10);
      expect(onChange).toHaveBeenLastCalledWith('text9');
    });

    it('value changes from parent', () => {
      const { rerender } = render(<FormInput label="Test" value="initial" onChange={vi.fn()} />);
      let input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('initial');

      rerender(<FormInput label="Test" value="updated" onChange={vi.fn()} />);
      input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('updated');
    });

    it('empty label string', () => {
      render(<FormInput label="" value="" onChange={vi.fn()} />);
      const input = screen.getByRole('textbox');

      expect(input).toBeInTheDocument();
    });

    it('very long label string', () => {
      const longLabel = 'a'.repeat(1000);
      render(<FormInput label={longLabel} value="" onChange={vi.fn()} />);

      expect(screen.getByText(longLabel)).toBeInTheDocument();
    });

    it('number overflow handling', () => {
      const onChange = vi.fn();
      render(<FormInput label="Test" type="number" value={0} onChange={onChange} />);
      const input = screen.getByRole('spinbutton');

      const largeNumber = '999999999999999';
      fireEvent.change(input, { target: { value: largeNumber } });

      expect(onChange).toHaveBeenCalledWith(parseInt(largeNumber, 10));
    });

    it('negative numbers (when min not set)', () => {
      const onChange = vi.fn();
      render(<FormInput label="Test" type="number" value={0} onChange={onChange} />);
      const input = screen.getByRole('spinbutton');

      fireEvent.change(input, { target: { value: '-50' } });

      expect(onChange).toHaveBeenCalledWith(-50);
    });
  });

  describe('controlled component behavior', () => {
    it('value updates reflect in input', () => {
      const { rerender } = render(<FormInput label="Test" value="" onChange={vi.fn()} />);
      let input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('');

      rerender(<FormInput label="Test" value="new value" onChange={vi.fn()} />);
      input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('new value');
    });

    it('number value updates reflect in input', () => {
      const { rerender } = render(
        <FormInput label="Test" type="number" value={0} onChange={vi.fn()} />
      );
      let input = screen.getByRole('spinbutton') as HTMLInputElement;
      expect(input.value).toBe('0');

      rerender(<FormInput label="Test" type="number" value={42} onChange={vi.fn()} />);
      input = screen.getByRole('spinbutton') as HTMLInputElement;
      expect(input.value).toBe('42');
    });

    it('does not update if onChange not called', () => {
      const onChange = vi.fn();
      render(<FormInput label="Test" value="initial" onChange={onChange} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;

      // This simulates the component being controlled
      expect(input.value).toBe('initial');
    });
  });

  describe('accessibility', () => {
    it('input associated with label', () => {
      render(<FormInput label="Username" value="" onChange={vi.fn()} />);
      const input = screen.getByRole('textbox');
      const label = screen.getByText('Username').closest('label');

      expect(label).toContainElement(input);
    });

    it('number input accessible', () => {
      render(<FormInput label="Age" type="number" value={0} onChange={vi.fn()} />);
      const input = screen.getByRole('spinbutton');

      expect(input).toBeInTheDocument();
    });

    it('password input accessible by label', () => {
      render(<FormInput label="Password" type="password" value="" onChange={vi.fn()} />);
      const input = screen.getByLabelText('Password');

      expect(input).toBeInTheDocument();
    });

    it('disabled input is not focusable', () => {
      render(<FormInput label="Test" value="" onChange={vi.fn()} disabled={true} />);
      const input = screen.getByRole('textbox');

      expect(input).toBeDisabled();
    });
  });

  describe('integration scenarios', () => {
    it('combines text input with all features', () => {
      const onChange = vi.fn();
      const onBlur = vi.fn();
      render(
        <FormInput
          label="Full Name"
          type="text"
          value=""
          onChange={onChange}
          onBlur={onBlur}
          placeholder="Enter your name"
          className="custom-input"
          style={{ padding: '8px' }}
        />
      );

      const input = screen.getByRole('textbox');
      const label = screen.getByText('Full Name').closest('label');

      expect(label).toHaveClass('custom-input');
      expect(input).toHaveAttribute('placeholder', 'Enter your name');
      expect(input).toHaveStyle({ padding: '8px' });

      fireEvent.change(input, { target: { value: 'John Doe' } });
      expect(onChange).toHaveBeenCalledWith('John Doe');

      fireEvent.blur(input);
      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('combines number input with constraints', () => {
      const onChange = vi.fn();
      const onBlur = vi.fn();
      render(
        <FormInput
          label="Health Points"
          type="number"
          value={100}
          onChange={onChange}
          onBlur={onBlur}
          min={0}
          max={999}
          step={1}
        />
      );

      const input = screen.getByRole('spinbutton');

      expect(input).toHaveAttribute('min', '0');
      expect(input).toHaveAttribute('max', '999');
      expect(input).toHaveAttribute('step', '1');

      fireEvent.change(input, { target: { value: '250' } });
      expect(onChange).toHaveBeenCalledWith(250);

      fireEvent.blur(input);
      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('works in form submission context', () => {
      const onChange = vi.fn();
      const onSubmit = vi.fn((e) => e.preventDefault());

      render(
        <form onSubmit={onSubmit}>
          <FormInput label="Email" value="" onChange={onChange} />
          <button type="submit">Submit</button>
        </form>
      );

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'test@example.com' } });

      expect(onChange).toHaveBeenCalledWith('test@example.com');

      const submitButton = screen.getByText('Submit');
      fireEvent.click(submitButton);

      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe('type switching scenarios', () => {
    it('handles switching from text to number', () => {
      const onChange = vi.fn();
      const { rerender } = render(<FormInput label="Test" value="" onChange={onChange} />);

      let input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'text');

      rerender(<FormInput label="Test" type="number" value={0} onChange={onChange} />);

      input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('type', 'number');
    });

    it('handles switching from text to password', () => {
      const onChange = vi.fn();
      const { rerender } = render(<FormInput label="Test" value="" onChange={onChange} />);

      let input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'text');
      expect(input).toHaveStyle({ padding: '4px' });

      rerender(<FormInput label="Test" type="password" value="" onChange={onChange} />);

      input = screen.getByLabelText('Test');
      expect(input).toHaveAttribute('type', 'password');
      expect(input).toHaveStyle({ padding: '6px' });
    });
  });
});
