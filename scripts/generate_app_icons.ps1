param(
    [string]$SourcePath = "C:\Users\THAMIZHARASAN G\.gemini\antigravity-ide\brain\6d18f4b0-3cb1-45a8-8701-e17515dc46d5\.user_uploaded\media_1792281713085.jpg",
    [string]$RootDir = "c:\Users\THAMIZHARASAN G\OneDrive\Documents\GitHub\family-ai-assistant-mobile-app"
)

Add-Type -AssemblyName System.Drawing

Write-Host "Loading source image from: $SourcePath"
$sourceImg = [System.Drawing.Bitmap]::new($SourcePath)

# Sample background color near corners (e.g. at x=10, y=10)
$bgSample = $sourceImg.GetPixel(10, 10)
$hexColor = "#{0:X2}{1:X2}{2:X2}" -f $bgSample.R, $bgSample.G, $bgSample.B
Write-Host "Detected background color: $hexColor"

# Ensure asset directories exist
$assetsDir = Join-Path $RootDir "src\assets"
if (-not (Test-Path $assetsDir)) { New-Item -ItemType Directory -Path $assetsDir -Force | Out-Null }
$publicDir = Join-Path $RootDir "public"
$resDir = Join-Path $RootDir "android\app\src\main\res"

# Save master logo in assets and public
$sourceImg.Save((Join-Path $assetsDir "logo.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$sourceImg.Save((Join-Path $publicDir "app-logo.png"), [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Saved master logo to src/assets/logo.png and public/app-logo.png"

# Helper function to resize with high quality bicubic interpolation
function Resize-Image {
    param (
        [System.Drawing.Bitmap]$Source,
        [int]$TargetWidth,
        [int]$TargetHeight,
        [bool]$AsCircle = $false,
        [float]$ContentScale = 1.0, # for adaptive foreground centering
        [System.Drawing.Color]$BackgroundColor = [System.Drawing.Color]::Transparent
    )

    $dest = [System.Drawing.Bitmap]::new($TargetWidth, $TargetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $g.Clear($BackgroundColor)

    if ($AsCircle) {
        $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
        $path.AddEllipse(0, 0, $TargetWidth, $TargetHeight)
        $g.SetClip($path)
    }

    if ($ContentScale -ne 1.0) {
        $w = [int]($TargetWidth * $ContentScale)
        $h = [int]($TargetHeight * $ContentScale)
        $x = [int](($TargetWidth - $w) / 2)
        $y = [int](($TargetHeight - $h) / 2)
        $g.DrawImage($Source, $x, $y, $w, $h)
    } else {
        $g.DrawImage($Source, 0, 0, $TargetWidth, $TargetHeight)
    }

    $g.Dispose()
    return $dest
}

# 1. Generate Android Mipmaps
$mipmapConfigs = @(
    @{ Name = "mipmap-mdpi"; Size = 48; FgSize = 108 },
    @{ Name = "mipmap-hdpi"; Size = 72; FgSize = 162 },
    @{ Name = "mipmap-xhdpi"; Size = 96; FgSize = 216 },
    @{ Name = "mipmap-xxhdpi"; Size = 144; FgSize = 324 },
    @{ Name = "mipmap-xxxhdpi"; Size = 192; FgSize = 432 }
)

foreach ($cfg in $mipmapConfigs) {
    $folder = Join-Path $resDir $cfg.Name
    if (-not (Test-Path $folder)) { New-Item -ItemType Directory -Path $folder -Force | Out-Null }

    # Square standard launcher
    $std = Resize-Image -Source $sourceImg -TargetWidth $cfg.Size -TargetHeight $cfg.Size
    $std.Save((Join-Path $folder "ic_launcher.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $std.Dispose()

    # Circular launcher (round)
    $round = Resize-Image -Source $sourceImg -TargetWidth $cfg.Size -TargetHeight $cfg.Size -AsCircle $true
    $round.Save((Join-Path $folder "ic_launcher_round.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $round.Dispose()

    # Foreground for adaptive icon (scaled to 72% within canvas so full peacock and ornament fit safe-zone)
    $fg = Resize-Image -Source $sourceImg -TargetWidth $cfg.FgSize -TargetHeight $cfg.FgSize -ContentScale 0.76
    $fg.Save((Join-Path $folder "ic_launcher_foreground.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $fg.Dispose()

    Write-Host "Generated Android icons for $($cfg.Name): ($($cfg.Size)x$($cfg.Size))"
}

# Update ic_launcher_background.xml color
$bgXmlPath = Join-Path $resDir "values\ic_launcher_background.xml"
$bgXmlContent = @"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">$hexColor</color>
</resources>
"@
Set-Content -Path $bgXmlPath -Value $bgXmlContent -Encoding UTF8
Write-Host "Updated ic_launcher_background.xml with background color: $hexColor"

# 2. Generate Web / PWA Icons
Write-Host "Generating Web and PWA icons..."

# PWA 192x192
$pwa192 = Resize-Image -Source $sourceImg -TargetWidth 192 -TargetHeight 192
$pwa192.Save((Join-Path $publicDir "pwa-192x192.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$pwa192.Dispose()

# PWA 512x512
$pwa512 = Resize-Image -Source $sourceImg -TargetWidth 512 -TargetHeight 512
$pwa512.Save((Join-Path $publicDir "pwa-512x512.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$pwa512.Dispose()

# PWA Maskable 512x512 (scaled to 82% inside background for Android Chrome install prompt)
$pwaMaskable = Resize-Image -Source $sourceImg -TargetWidth 512 -TargetHeight 512 -ContentScale 0.84 -BackgroundColor $bgSample
$pwaMaskable.Save((Join-Path $publicDir "pwa-maskable-512x512.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$pwaMaskable.Dispose()

# Apple Touch Icon 180x180
$appleIcon = Resize-Image -Source $sourceImg -TargetWidth 180 -TargetHeight 180
$appleIcon.Save((Join-Path $publicDir "apple-touch-icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$appleIcon.Dispose()

# Favicon 64x64 PNG saved as favicon.ico
$fav = Resize-Image -Source $sourceImg -TargetWidth 64 -TargetHeight 64
$fav.Save((Join-Path $publicDir "favicon.ico"), [System.Drawing.Imaging.ImageFormat]::Icon)
$fav.Dispose()

$sourceImg.Dispose()
Write-Host "Successfully generated all Android and PWA mobile icons!"
