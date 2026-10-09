#Requires -Version 5.1
<#
云山录本地服务器（无需 Python / Node，用 .NET HttpListener）
用法：右键「使用 PowerShell 运行」，或 powershell -ExecutionPolicy Bypass -File .\start.ps1
然后浏览器打开 http://127.0.0.1:8123/
#>
param([int]$Port = 8123)

$root = $PSScriptRoot
$mime = @{
  '.html' = 'text/html; charset=utf-8';
  '.js'   = 'text/javascript; charset=utf-8';
  '.css'  = 'text/css; charset=utf-8';
  '.json' = 'application/json; charset=utf-8';
  '.png'  = 'image/png';
  '.svg'  = 'image/svg+xml';
  '.ico'  = 'image/x-icon';
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
try {
  $listener.Start()
} catch {
  Write-Host "端口 $Port 启动失败（可能已被占用）：$_"
  exit 1
}

Write-Host ""
Write-Host "  云山录 · 体素江湖"
Write-Host "  http://127.0.0.1:$Port/"
Write-Host "  关闭此窗口即可停止服务"
Write-Host ""

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    $rel = [Uri]::UnescapeDataString($req.Url.AbsolutePath)
    if ($rel -eq '/' -or $rel -eq '') { $rel = '/index.html' }
    $full = [System.IO.Path]::GetFullPath((Join-Path $root ($rel.TrimStart('/') -replace '/', '\')))
    if (-not $full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
      $res.StatusCode = 403
      $res.Close()
      continue
    }
    if (Test-Path $full -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $res.ContentLength64 = $bytes.Length
      try { $res.OutputStream.Write($bytes, 0, $bytes.Length) } catch {}
    } else {
      $res.StatusCode = 404
    }
    $res.Close()
  }
} finally {
  $listener.Stop()
}
