$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$sourcePath = Join-Path $PSScriptRoot "..\src\assets\app-icon.png"
$source = [System.Drawing.Image]::FromFile($sourcePath)
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$images = [System.Collections.Generic.List[byte[]]]::new()

try {
  foreach ($size in $sizes) {
    $scaled = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($scaled)
    $stream = [System.IO.MemoryStream]::new()
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.DrawImage($source, 0, 0, $size, $size)
      $scaled.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
      $images.Add($stream.ToArray())
      if ($size -eq 256) {
        [System.IO.File]::WriteAllBytes((Join-Path $PSScriptRoot "icon.png"), $stream.ToArray())
      }
    } finally {
      $stream.Dispose()
      $graphics.Dispose()
      $scaled.Dispose()
    }
  }
} finally {
  $source.Dispose()
}

$output = [System.IO.File]::Create((Join-Path $PSScriptRoot "icon.ico"))
$writer = [System.IO.BinaryWriter]::new($output)
try {
  $writer.Write([uint16]0)
  $writer.Write([uint16]1)
  $writer.Write([uint16]$sizes.Count)
  $offset = 6 + 16 * $sizes.Count
  for ($index = 0; $index -lt $sizes.Count; $index++) {
    $writer.Write([byte]($sizes[$index] % 256))
    $writer.Write([byte]($sizes[$index] % 256))
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]32)
    $writer.Write([uint32]$images[$index].Length)
    $writer.Write([uint32]$offset)
    $offset += $images[$index].Length
  }
  foreach ($bytes in $images) { $writer.Write([byte[]]$bytes) }
} finally {
  $writer.Dispose()
}
