# HeroByte Assets

This folder contains all visual assets for the HeroByte project.

## Folder Structure

### `images/logo/`
Source logo art:
- `herobyte.png` - Main logo
- `herobyte-square.png` - Square logo (app icon source)
- `herobyte-Pixel.png` - Pixel-art logo variant
- `LogoSm.webp` - Small logo (used by the repo README)
- `HBicon.png` / `HBicon-full.png` - HB monogram icon
- `favicon_io/` - Generated favicon set (ico, PNG sizes, webmanifest)

**Shipped copies live elsewhere.** The client serves its assets from
`apps/client/public/` (`logo-wide.webp`, `favicon.ico`, `icon-192.png`,
`icon-512.png`, …). This folder holds the source art; update both when the
branding changes.

### `images/tiles/`
Reference tile art with provenance notes ([PROVENANCE.md](images/tiles/PROVENANCE.md)).
Terrain in HeroByte is generated procedurally — these are study/reference
images, not runtime assets.

### `images/ui/`
Placeholder for UI element source art (pixel-art components, button sprites,
icon sets, frame decorations). Currently empty.

### `images/screenshots/`
Placeholder for promotional images. **App screenshots for the docs are not
kept here** — they are generated into `docs/user-guide/img/` by
`pnpm docs:screenshots`; see the [User Guide](../docs/user-guide/README.md).

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
Reference the copy served from `apps/client/public/`, not this folder:
```tsx
<img src="/logo-wide.webp" alt="HeroByte" />
```

### In README/Markdown
```markdown
![HeroByte Logo](assets/images/logo/LogoSm.webp)
```

### In HTML
```html
<link rel="icon" href="/favicon.ico" />
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
