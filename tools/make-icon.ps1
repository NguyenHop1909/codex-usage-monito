Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot '..\assets'
New-Item -ItemType Directory -Force -Path $out | Out-Null
foreach ($size in @(16, 32, 48, 64, 128, 256)) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)
  $pad = [Math]::Max(1, [int]($size * 0.06))
  $g.FillEllipse((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 14, 165, 233))), $pad, $pad, $size-2*$pad, $size-2*$pad)
  $inner = [int]($size * 0.18)
  $g.FillEllipse((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 10, 18, 32))), $inner, $inner, $size-2*$inner, $size-2*$inner)
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 167, 139, 250))
  $barW = [Math]::Max(2, [int]($size * 0.11)); $bottom = [int]($size * 0.72)
  $g.FillRectangle($brush, [int]($size*.31), [int]($size*.50), $barW, $bottom-[int]($size*.50))
  $g.FillRectangle($brush, [int]($size*.45), [int]($size*.35), $barW, $bottom-[int]($size*.35))
  $g.FillRectangle($brush, [int]($size*.59), [int]($size*.43), $barW, $bottom-[int]($size*.43))
  $bmp.Save((Join-Path $out "icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
Copy-Item (Join-Path $out 'icon-256.png') (Join-Path $out 'icon.png') -Force
