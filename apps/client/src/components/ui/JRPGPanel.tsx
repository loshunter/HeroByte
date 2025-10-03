// ============================================================================
// JRPG PANEL COMPONENT
// ============================================================================
// Reusable SNES-style panel/frame wrapper for consistent UI theming

import React from 'react';

export type JRPGPanelVariant = 'default' | 'bevel' | 'simple';

interface JRPGPanelProps {
  children: React.ReactNode;
  variant?: JRPGPanelVariant;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function JRPGPanel({
  children,
  variant = 'default',
  title,
  className = '',
  style = {},
}: JRPGPanelProps) {
  const variantClass = {
    default: 'jrpg-frame',
    bevel: 'jrpg-frame-bevel',
    simple: 'jrpg-frame-simple',
  }[variant];

  return (
    <div className={`${variantClass} jrpg-spacing-md ${className}`} style={style}>
      {title && (
        <div className="jrpg-text-command jrpg-text-highlight" style={{ marginBottom: '12px', textAlign: 'center' }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

interface JRPGButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'danger' | 'success';
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function JRPGButton({
  children,
  onClick,
  variant = 'default',
  disabled = false,
  className = '',
  style = {},
}: JRPGButtonProps) {
  const variantClass = {
    default: 'jrpg-button',
    primary: 'jrpg-button jrpg-button-primary',
    danger: 'jrpg-button jrpg-button-danger',
    success: 'jrpg-button jrpg-button-success',
  }[variant];

  return (
    <button
      className={`${variantClass} ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={{
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
