# HeroByte Assets

This folder contains all visual assets for the HeroByte project.

## Folder Structure

### `images/logo/`
Logo files in various formats and sizes:
- `herobyte-logo.png` - Main logo (transparent background)
- `herobyte-logo.svg` - Vector logo (scalable)
- `herobyte-icon.png` - App icon/favicon (512x512 recommended)
- `herobyte-banner.png` - Wide banner for GitHub/social media

### `images/ui/`
User interface elements and graphics:
- Retro pixel art UI components
- Button sprites
- Icon sets
- Background textures
- Frame decorations

### `images/screenshots/`
Screenshots and promotional images:
- Gameplay screenshots
- Feature demonstrations
- Tutorial images
- Marketing materials

## Guidelines

### Logo Files
- **Format**: PNG with transparency or SVG
- **Colors**: Match the retro NES/SNES aesthetic
- **Sizes**: Provide multiple resolutions (256x256, 512x512, 1024x1024)

### UI Elements
- **Style**: Pixel art or retro-inspired
- **Format**: PNG with transparency preferred
- **Optimization**: Compress for web use

### Screenshots
- **Format**: PNG or JPG
- **Resolution**: 1920x1080 or higher recommended
- **Content**: Show key features and gameplay

## Usage in Code

### In React Components
```tsx
import logo from '../../assets/images/logo/herobyte-logo.png';

<img src={logo} alt="HeroByte Logo" />
```

### In README/Markdown
```markdown
![HeroByte Logo](assets/images/logo/herobyte-logo.png)
```

### In HTML
```html
<link rel="icon" href="/assets/images/logo/herobyte-icon.png" />
```

## Contributing Assets

When adding new assets:
1. Use descriptive filenames (lowercase, hyphen-separated)
2. Optimize file sizes before committing
3. Add attribution in comments if using third-party assets
4. Update this README if adding new categories

## Image Optimization Tools

- **TinyPNG**: https://tinypng.com/ (PNG/JPG compression)
- **SVGOMG**: https://jakearchibald.github.io/svgomg/ (SVG optimization)
- **ImageOptim**: https://imageoptim.com/ (Mac)
- **Squoosh**: https://squoosh.app/ (Web-based)

---

⚡ **Keep it retro, keep it optimized!**
