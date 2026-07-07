# Bake the Tileset v1 atlas: packs assets/images/tiles/*.png into one sheet
# plus a UV manifest at apps/client/public/tiles/.
#
# Interim Windows-only tool (PowerShell + System.Drawing) — the repo's pnpm
# store currently can't take a `sharp` devDependency without a full relink.
# Outputs are committed, so CI never runs this; re-run it only when the tile
# art changes. Follow-up for the art track: replace with a cross-platform
# node+sharp pipeline (palette quantization for Palette-Swap Moods lands
# there too).
#
# Usage: pwsh scripts/build-tile-atlas.ps1 [-TileSize 128]

param(
  [int]$TileSize = 128
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path $PSScriptRoot -Parent
$sourceDir = Join-Path $repoRoot "assets\images\tiles"
$outDir = Join-Path $repoRoot "apps\client\public\tiles"
New-Item -ItemType Directory -Force $outDir | Out-Null

# Family order is part of the manifest contract: one row per family.
$families = [ordered]@{
  "terrain:dirt"        = "dirt_floor"
  "terrain:grass"       = "grass_tile"
  "terrain:path"        = "path_tile"
  "terrain:stone-floor" = "stone_floor"
  "terrain:wood-floor"  = "wood_floor"
}

$columns = 5
$rows = $families.Count

# Optional quarter-tile (blob47) region: a procedurally generated grid of 64px
# quarters (scripts/gen-tile-blob47.mjs), (4 + interiorVariants) columns wide x
# 4 corners tall. Packed below the whole-tile grid at tile origin (col 0,
# row = $rows) and consumed by tileAtlas.quarterRectsForCell. Fixed 64px
# quarters, so it only applies at the default 128px tile size. The interior
# variant count is derived from the sheet width; the manifest records blob47
# only when present.
$blob47Family = "terrain:grass"
$blob47Path = Join-Path $sourceDir "grass_blob47.png"
$quarter = [int]($TileSize / 2)
$hasBlob47 = (Test-Path $blob47Path) -and ($TileSize -eq 128)
$blob47Width = 0; $blob47Height = 0; $blob47Interior = 0
if ($hasBlob47) {
  $probe = [System.Drawing.Image]::FromFile($blob47Path)
  $blob47Width = $probe.Width; $blob47Height = $probe.Height
  $probe.Dispose()
  if ($blob47Height -ne (4 * $quarter)) { throw "grass_blob47.png height must be $(4 * $quarter), got $blob47Height" }
  if ($blob47Width % $quarter -ne 0) { throw "grass_blob47.png width must be a multiple of $quarter, got $blob47Width" }
  $blob47Interior = [int]($blob47Width / $quarter) - 4
  if ($blob47Interior -lt 1) { throw "grass_blob47.png needs at least 5 columns (4 edges + >=1 interior)" }
}
$extraHeight = if ($hasBlob47) { $blob47Height } else { 0 }
$atlasWidth = [Math]::Max(($columns * $TileSize), $blob47Width)

$atlas = New-Object System.Drawing.Bitmap $atlasWidth, (($rows * $TileSize) + $extraHeight)
$graphics = [System.Drawing.Graphics]::FromImage($atlas)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

$manifestFamilies = [ordered]@{}
$row = 0
foreach ($entry in $families.GetEnumerator()) {
  $variantFiles = Get-ChildItem $sourceDir -File -Filter "$($entry.Value)_*.png" |
    Sort-Object { [int]($_.BaseName -replace ".*_(\d+)$", '$1') }
  if ($variantFiles.Count -eq 0) { throw "No variants found for $($entry.Value)" }

  $variants = @()
  $col = 0
  $averageR = 0.0; $averageG = 0.0; $averageB = 0.0
  foreach ($file in $variantFiles) {
    $source = [System.Drawing.Image]::FromFile($file.FullName)
    $graphics.DrawImage($source, ($col * $TileSize), ($row * $TileSize), $TileSize, $TileSize)

    # Average color per variant via a 1x1 downscale.
    $onePixel = New-Object System.Drawing.Bitmap 1, 1
    $oneGraphics = [System.Drawing.Graphics]::FromImage($onePixel)
    $oneGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBilinear
    $oneGraphics.DrawImage($source, 0, 0, 1, 1)
    $pixel = $onePixel.GetPixel(0, 0)
    $averageR += $pixel.R; $averageG += $pixel.G; $averageB += $pixel.B
    $oneGraphics.Dispose(); $onePixel.Dispose()
    $source.Dispose()

    $variants += [ordered]@{ col = $col; row = $row }
    $col += 1
  }
  $count = $variantFiles.Count
  $averageColor = "#{0:x2}{1:x2}{2:x2}" -f [int]($averageR / $count), [int]($averageG / $count), [int]($averageB / $count)
  $manifestFamilies[$entry.Key] = [ordered]@{
    variants = $variants
    averageColor = $averageColor
  }
  $row += 1
}

# Pack the blob47 quarter-tile region unscaled below the whole-tile grid.
if ($hasBlob47) {
  $blobImg = [System.Drawing.Image]::FromFile($blob47Path)
  $graphics.DrawImageUnscaled($blobImg, 0, ($rows * $TileSize))
  $blobImg.Dispose()
  $manifestFamilies[$blob47Family]["blob47"] = [ordered]@{ col = 0; row = $rows; interiorVariants = $blob47Interior }
  Write-Host "blob47: packed $blob47Family ($blob47Width x $blob47Height, $blob47Interior interior variants) at tile (0, $rows)"
}

$graphics.Dispose()
$atlasPath = Join-Path $outDir "tileset-v1.png"
$atlas.Save($atlasPath, [System.Drawing.Imaging.ImageFormat]::Png)
$atlas.Dispose()

$manifest = [ordered]@{
  version = 1
  image = "tileset-v1.png"
  tileSize = $TileSize
  columns = $columns
  license = [ordered]@{
    source = "assets/images/tiles (repo history: commit 4c9e5cb4)"
    license = "UNSPECIFIED - confirm provenance and license before public release"
    blob47 = "grass_blob47.png is procedurally generated by scripts/gen-tile-blob47.mjs (original work, no third-party assets); see assets/images/tiles/PROVENANCE.md"
  }
  families = $manifestFamilies
}
$manifestPath = Join-Path $outDir "tileset-v1.json"
$manifest | ConvertTo-Json -Depth 6 | Set-Content $manifestPath -Encoding utf8NoBOM

$atlasKb = [Math]::Round((Get-Item $atlasPath).Length / 1KB, 1)
Write-Host "Atlas: $atlasPath ($atlasKb KB, ${atlasWidth}x$(($rows * $TileSize) + $extraHeight))"
Write-Host "Manifest: $manifestPath"
