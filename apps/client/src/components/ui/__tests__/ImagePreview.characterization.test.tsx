/**
 * Characterization tests for ImagePreview
 *
 * These tests capture the behavior of the original code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source patterns in DMMenu.tsx:
 * - PropEditor (lines 197-213): 48x48 cover preview with border
 * - NPCEditor portrait (lines 420-434): 100% width, 100px maxHeight, cover (NO border)
 * - NPCEditor token (lines 455-471): 48x48 cover preview with border
 *
 * Target: apps/client/src/components/ui/ImagePreview.tsx
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';

// ============================================================================
// INLINE IMPLEMENTATION FOR TESTING
// ============================================================================
// This will be replaced after extraction. For now, we implement the component
// inline to test the expected behavior based on the original DMMenu patterns.

interface ImagePreviewProps {
  src: string | null;
  alt: string;
  width?: string | number;
  height?: string | number;
  maxHeight?: string | number;
  objectFit?: 'cover' | 'contain';
  alignSelf?: 'flex-start' | 'center';
  showBorder?: boolean; // Pattern-specific: PropEditor and NPCEditor token have border, portrait does not
  onLoadError?: () => void;
}

const ImagePreview = ({
  src,
  alt,
  width = '48px',
  height = '48px',
  maxHeight,
  objectFit = 'cover',
  alignSelf = 'flex-start',
  showBorder = true,
  onLoadError,
}: ImagePreviewProps) => {
  // Don't render if src is null or empty
  if (!src || src.trim() === '') {
    return null;
  }

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    (e.currentTarget as HTMLImageElement).style.display = 'none';
    if (onLoadError) {
      onLoadError();
    }
  };

  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    objectFit,
    borderRadius: '4px',
    alignSelf,
  };

  if (maxHeight) {
    style.maxHeight = typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight;
  }

  if (showBorder) {
    style.border = '1px solid var(--jrpg-border-gold)';
  }

  return <img src={src} alt={alt} style={style} onError={handleError} />;
};

// ============================================================================
// TESTS
// ============================================================================

describe('ImagePreview - Characterization', () => {
  describe('basic rendering', () => {
    it('renders image when src is valid string', () => {
      render(<ImagePreview src="https://example.com/image.jpg" alt="test image" />);
      const img = screen.getByAltText('test image');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/image.jpg');
    });

    it('does NOT render when src is null', () => {
      const { container } = render(<ImagePreview src={null} alt="test image" />);
      expect(container.firstChild).toBeNull();
    });

    it('does NOT render when src is empty string', () => {
      const { container } = render(<ImagePreview src="" alt="test image" />);
      expect(container.firstChild).toBeNull();
    });

    it('does NOT render when src is whitespace only', () => {
      const { container } = render(<ImagePreview src="   " alt="test image" />);
      expect(container.firstChild).toBeNull();
    });

    it('sets correct alt text', () => {
      render(<ImagePreview src="https://example.com/image.jpg" alt="Custom Alt Text" />);
      const img = screen.getByAltText('Custom Alt Text');
      expect(img).toHaveAttribute('alt', 'Custom Alt Text');
    });
  });

  describe('default styling', () => {
    it('default width: 48px', () => {
      render(<ImagePreview src="https://example.com/image.jpg" alt="test" />);
      const img = screen.getByAltText('test');
      expect(img).toHaveStyle({ width: '48px' });
    });

    it('default height: 48px', () => {
      render(<ImagePreview src="https://example.com/image.jpg" alt="test" />);
      const img = screen.getByAltText('test');
      expect(img).toHaveStyle({ height: '48px' });
    });

    it('default objectFit: cover', () => {
      render(<ImagePreview src="https://example.com/image.jpg" alt="test" />);
      const img = screen.getByAltText('test');
      expect(img).toHaveStyle({ objectFit: 'cover' });
    });

    it('default alignSelf: flex-start', () => {
      render(<ImagePreview src="https://example.com/image.jpg" alt="test" />);
      const img = screen.getByAltText('test');
      expect(img).toHaveStyle({ alignSelf: 'flex-start' });
    });

    it('borderRadius: 4px (always)', () => {
      render(<ImagePreview src="https://example.com/image.jpg" alt="test" />);
      const img = screen.getByAltText('test');
      expect(img).toHaveStyle({ borderRadius: '4px' });
    });

    it('border: 1px solid var(--jrpg-border-gold) (when showBorder=true, default)', () => {
      render(<ImagePreview src="https://example.com/image.jpg" alt="test" />);
      const img = screen.getByAltText('test');
      expect(img).toHaveStyle({ border: '1px solid var(--jrpg-border-gold)' });
    });

    it('no border when showBorder=false', () => {
      render(<ImagePreview src="https://example.com/image.jpg" alt="test" showBorder={false} />);
      const img = screen.getByAltText('test');
      expect(img).not.toHaveStyle({ border: '1px solid var(--jrpg-border-gold)' });
    });
  });

  describe('custom sizing', () => {
    it('custom width (string "100px")', () => {
      render(<ImagePreview src="https://example.com/image.jpg" alt="test" width="100px" />);
      const img = screen.getByAltText('test');
      expect(img).toHaveStyle({ width: '100px' });
    });

    it('custom width (number 100)', () => {
      render(<ImagePreview src="https://example.com/image.jpg" alt="test" width={100} />);
      const img = screen.getByAltText('test');
      expect(img).toHaveStyle({ width: '100px' });
    });

    it('custom height (string "100px")', () => {
      render(<ImagePreview src="https://example.com/image.jpg" alt="test" height="100px" />);
      const img = screen.getByAltText('test');
      expect(img).toHaveStyle({ height: '100px' });
    });

    it('custom height (number 100)', () => {
      render(<ImagePreview src="https://example.com/image.jpg" alt="test" height={100} />);
      const img = screen.getByAltText('test');
      expect(img).toHaveStyle({ height: '100px' });
    });

    it('maxHeight override (100px portrait variant)', () => {
      render(
        <ImagePreview src="https://example.com/image.jpg" alt="test" maxHeight="100px" />
      );
      const img = screen.getByAltText('test');
      expect(img).toHaveStyle({ maxHeight: '100px' });
    });

    it('maxHeight with number value', () => {
      render(<ImagePreview src="https://example.com/image.jpg" alt="test" maxHeight={100} />);
      const img = screen.getByAltText('test');
      expect(img).toHaveStyle({ maxHeight: '100px' });
    });

    it('width "100%" + maxHeight "100px" (portrait pattern)', () => {
      render(
        <ImagePreview
          src="https://example.com/image.jpg"
          alt="test"
          width="100%"
          maxHeight="100px"
        />
      );
      const img = screen.getByAltText('test');
      expect(img).toHaveStyle({ width: '100%', maxHeight: '100px' });
    });

    it('custom objectFit: contain', () => {
      render(
        <ImagePreview src="https://example.com/image.jpg" alt="test" objectFit="contain" />
      );
      const img = screen.getByAltText('test');
      expect(img).toHaveStyle({ objectFit: 'contain' });
    });

    it('custom alignSelf: center', () => {
      render(
        <ImagePreview src="https://example.com/image.jpg" alt="test" alignSelf="center" />
      );
      const img = screen.getByAltText('test');
      expect(img).toHaveStyle({ alignSelf: 'center' });
    });
  });

  describe('error handling', () => {
    it('onError handler hides image (display: none)', () => {
      render(<ImagePreview src="https://example.com/broken.jpg" alt="test" />);
      const img = screen.getByAltText('test');

      // Trigger error
      fireEvent.error(img);

      // Check that display is set to none
      expect(img).toHaveStyle({ display: 'none' });
    });

    it('onLoadError callback called when image fails to load', () => {
      const onLoadError = vi.fn();
      render(
        <ImagePreview
          src="https://example.com/broken.jpg"
          alt="test"
          onLoadError={onLoadError}
        />
      );
      const img = screen.getByAltText('test');

      // Trigger error
      fireEvent.error(img);

      expect(onLoadError).toHaveBeenCalledTimes(1);
    });

    it('onLoadError callback NOT called on successful load', () => {
      const onLoadError = vi.fn();
      render(
        <ImagePreview
          src="https://example.com/image.jpg"
          alt="test"
          onLoadError={onLoadError}
        />
      );

      // Don't trigger error, just render
      expect(onLoadError).not.toHaveBeenCalled();
    });

    it('multiple error triggers set display:none and call callback only once per trigger', () => {
      const onLoadError = vi.fn();
      render(
        <ImagePreview
          src="https://example.com/broken.jpg"
          alt="test"
          onLoadError={onLoadError}
        />
      );
      const img = screen.getByAltText('test');

      // First error
      fireEvent.error(img);
      expect(img).toHaveStyle({ display: 'none' });
      expect(onLoadError).toHaveBeenCalledTimes(1);

      // Second error (simulating retry or re-render scenario)
      fireEvent.error(img);
      expect(img).toHaveStyle({ display: 'none' });
      expect(onLoadError).toHaveBeenCalledTimes(2);
    });

    it('error state persists after re-render', () => {
      const { rerender } = render(
        <ImagePreview src="https://example.com/broken.jpg" alt="test" />
      );
      const img = screen.getByAltText('test');

      // Trigger error
      fireEvent.error(img);
      expect(img).toHaveStyle({ display: 'none' });

      // Re-render with same props
      rerender(<ImagePreview src="https://example.com/broken.jpg" alt="test" />);
      const imgAfterRerender = screen.getByAltText('test');

      // Display none should persist (inline style)
      expect(imgAfterRerender).toHaveStyle({ display: 'none' });
    });
  });

  describe('real-world patterns', () => {
    it('Prop/Token preview: 48x48, cover, flex-start, with border', () => {
      render(
        <ImagePreview
          src="https://example.com/token.png"
          alt="Token preview"
          width="48px"
          height="48px"
          objectFit="cover"
          alignSelf="flex-start"
          showBorder={true}
        />
      );
      const img = screen.getByAltText('Token preview');

      expect(img).toHaveStyle({
        width: '48px',
        height: '48px',
        objectFit: 'cover',
        alignSelf: 'flex-start',
        border: '1px solid var(--jrpg-border-gold)',
        borderRadius: '4px',
      });
    });

    it('Portrait preview: 100% width, 100px maxHeight, cover, flex-start, NO border', () => {
      // This matches the ACTUAL NPCEditor portrait pattern (line 420-434)
      render(
        <ImagePreview
          src="https://example.com/portrait.jpg"
          alt="NPC portrait"
          width="100%"
          maxHeight="100px"
          objectFit="cover"
          alignSelf="flex-start"
          showBorder={false}
        />
      );
      const img = screen.getByAltText('NPC portrait');

      expect(img).toHaveStyle({
        width: '100%',
        maxHeight: '100px',
        objectFit: 'cover',
        alignSelf: 'flex-start',
        borderRadius: '4px',
      });
      expect(img).not.toHaveStyle({ border: '1px solid var(--jrpg-border-gold)' });
    });

    it('All three patterns render correctly with respective props', () => {
      const { rerender } = render(
        <ImagePreview
          src="https://example.com/prop.jpg"
          alt="Prop preview"
          width="48px"
          height="48px"
          showBorder={true}
        />
      );

      let img = screen.getByAltText('Prop preview');
      expect(img).toHaveStyle({ width: '48px', height: '48px' });

      // Switch to portrait
      rerender(
        <ImagePreview
          src="https://example.com/portrait.jpg"
          alt="Portrait"
          width="100%"
          maxHeight="100px"
          showBorder={false}
        />
      );

      img = screen.getByAltText('Portrait');
      expect(img).toHaveStyle({ width: '100%', maxHeight: '100px' });

      // Switch to token
      rerender(
        <ImagePreview
          src="https://example.com/token.png"
          alt="Token"
          width="48px"
          height="48px"
          showBorder={true}
        />
      );

      img = screen.getByAltText('Token');
      expect(img).toHaveStyle({ width: '48px', height: '48px' });
    });
  });

  describe('edge cases', () => {
    it('very long src URL', () => {
      const longUrl = `https://example.com/${'a'.repeat(1000)}.jpg`;
      render(<ImagePreview src={longUrl} alt="test" />);
      const img = screen.getByAltText('test');
      expect(img).toHaveAttribute('src', longUrl);
    });

    it('src with special characters', () => {
      const specialUrl = 'https://example.com/image?param=1&foo=bar#fragment';
      render(<ImagePreview src={specialUrl} alt="test" />);
      const img = screen.getByAltText('test');
      expect(img).toHaveAttribute('src', specialUrl);
    });

    it('src that changes after initial render', () => {
      const { rerender } = render(
        <ImagePreview src="https://example.com/image1.jpg" alt="test" />
      );
      let img = screen.getByAltText('test');
      expect(img).toHaveAttribute('src', 'https://example.com/image1.jpg');

      // Change src
      rerender(<ImagePreview src="https://example.com/image2.jpg" alt="test" />);
      img = screen.getByAltText('test');
      expect(img).toHaveAttribute('src', 'https://example.com/image2.jpg');
    });

    it('rapid src changes', () => {
      const { rerender } = render(
        <ImagePreview src="https://example.com/image1.jpg" alt="test" />
      );

      for (let i = 2; i <= 10; i++) {
        rerender(<ImagePreview src={`https://example.com/image${i}.jpg`} alt="test" />);
      }

      const img = screen.getByAltText('test');
      expect(img).toHaveAttribute('src', 'https://example.com/image10.jpg');
    });

    it('src changes from valid to null removes component', () => {
      const { rerender, container } = render(
        <ImagePreview src="https://example.com/image.jpg" alt="test" />
      );

      expect(screen.getByAltText('test')).toBeInTheDocument();

      rerender(<ImagePreview src={null} alt="test" />);

      expect(container.firstChild).toBeNull();
    });

    it('src changes from null to valid renders component', () => {
      const { rerender, container } = render(<ImagePreview src={null} alt="test" />);

      expect(container.firstChild).toBeNull();

      rerender(<ImagePreview src="https://example.com/image.jpg" alt="test" />);

      expect(screen.getByAltText('test')).toBeInTheDocument();
    });

    it('percentage width values work correctly', () => {
      render(<ImagePreview src="https://example.com/image.jpg" alt="test" width="75%" />);
      const img = screen.getByAltText('test');
      expect(img).toHaveStyle({ width: '75%' });
    });

    it('mixed unit values (%, px, em, rem)', () => {
      const { rerender } = render(
        <ImagePreview src="https://example.com/image.jpg" alt="test" width="50%" />
      );
      let img = screen.getByAltText('test');
      expect(img).toHaveStyle({ width: '50%' });

      rerender(<ImagePreview src="https://example.com/image.jpg" alt="test" width="10em" />);
      img = screen.getByAltText('test');
      expect(img).toHaveStyle({ width: '10em' });

      rerender(<ImagePreview src="https://example.com/image.jpg" alt="test" width="5rem" />);
      img = screen.getByAltText('test');
      expect(img).toHaveStyle({ width: '5rem' });
    });
  });

  describe('integration scenarios', () => {
    it('combines all custom props correctly', () => {
      const onLoadError = vi.fn();
      render(
        <ImagePreview
          src="https://example.com/custom.jpg"
          alt="Custom test"
          width="200px"
          height="150px"
          maxHeight="300px"
          objectFit="contain"
          alignSelf="center"
          showBorder={false}
          onLoadError={onLoadError}
        />
      );

      const img = screen.getByAltText('Custom test');

      expect(img).toHaveStyle({
        width: '200px',
        height: '150px',
        maxHeight: '300px',
        objectFit: 'contain',
        alignSelf: 'center',
        borderRadius: '4px',
      });
      expect(img).not.toHaveStyle({ border: '1px solid var(--jrpg-border-gold)' });

      // Trigger error
      fireEvent.error(img);
      expect(onLoadError).toHaveBeenCalledTimes(1);
      expect(img).toHaveStyle({ display: 'none' });
    });

    it('works within different container contexts', () => {
      const { container } = render(
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <ImagePreview src="https://example.com/image.jpg" alt="test" />
        </div>
      );

      const img = screen.getByAltText('test');
      expect(img).toBeInTheDocument();
      expect(img.parentElement).toBe(container.firstChild);
    });
  });

  describe('accessibility', () => {
    it('maintains alt text for screen readers', () => {
      render(
        <ImagePreview src="https://example.com/image.jpg" alt="Detailed description" />
      );
      const img = screen.getByAltText('Detailed description');
      expect(img).toHaveAccessibleName('Detailed description');
    });

    it('preserves alt text even after error', () => {
      render(<ImagePreview src="https://example.com/broken.jpg" alt="Failed image" />);
      const img = screen.getByAltText('Failed image');

      fireEvent.error(img);

      // Alt text should still be present
      expect(img).toHaveAttribute('alt', 'Failed image');
    });
  });
});
