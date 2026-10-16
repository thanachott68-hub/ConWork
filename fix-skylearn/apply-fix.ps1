# Applies patch-*.json (next to this script) to the "ConWork Split" folder. Each file is checked by SHA-256
# before and after; a file is written only if both checks pass. Originals are copied to _before-skylearn first.
$ErrorActionPreference = 'Stop'
$root = Join-Path (Split-Path $PSScriptRoot) 'ConWork Split'
$backup = Join-Path (Split-Path $PSScriptRoot) '_before-skylearn'
$utf8 = New-Object System.Text.UTF8Encoding($false)
function Sha([byte[]]$b) { $h = [Security.Cryptography.SHA256]::Create(); return (($h.ComputeHash($b) | ForEach-Object { $_.ToString('X2') }) -join '') }
$ok = 0; $fail = 0
foreach ($pf in Get-ChildItem -LiteralPath $PSScriptRoot -Filter 'patch-*.json') {
    try {
        $p = [IO.File]::ReadAllText($pf.FullName, $utf8) | ConvertFrom-Json
        $full = Join-Path $root $p.path
        if ($p.create) {
            $text = (@($p.create) -join "`n")
        } else {
            $bytes = [IO.File]::ReadAllBytes($full)
            if ((Sha $bytes) -ne $p.orig) { throw 'original file differs from the copy Claude edited' }
            $lines = New-Object System.Collections.Generic.List[string]
            $lines.AddRange([string[]]($utf8.GetString($bytes).Split([char]10)))
            $ops = @($p.ops)
            for ($k = $ops.Count - 1; $k -ge 0; $k--) {
                $op = @($ops[$k])
                if ($op.Count -eq 2) {
                    $li = [int]$op[0]; $line = $lines[$li]; $subs = @($op[1])
                    for ($m = $subs.Count - 1; $m -ge 0; $m--) {
                        $s = @($subs[$m]); $c1 = [int]$s[0]; $c2 = [int]$s[1]
                        $line = $line.Substring(0, $c1) + [string]$s[2] + $line.Substring($c2)
                    }
                    $lines[$li] = $line
                } else {
                    $i1 = [int]$op[0]; $i2 = [int]$op[1]
                    $new = @(); if ($null -ne $op[2]) { $new = [string[]]@($op[2]) }
                    $lines.RemoveRange($i1, $i2 - $i1)
                    if ($new.Count -gt 0) { $lines.InsertRange($i1, $new) }
                }
            }
            $text = ($lines -join "`n")
        }
        $out = $utf8.GetBytes($text)
        if ((Sha $out) -ne $p.new) { throw 'result check failed (patch file was not copied exactly)' }
        if (-not $p.create) {
            $dst = Join-Path $backup $p.path
            New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
            if (-not (Test-Path -LiteralPath $dst)) { Copy-Item -LiteralPath $full -Destination $dst }
        }
        New-Item -ItemType Directory -Force -Path (Split-Path $full) | Out-Null
        [IO.File]::WriteAllBytes($full, $out)
        Write-Host "OK    $($p.path)"; $ok++
    } catch {
        Write-Host "FAIL  $($pf.Name): $($_.Exception.Message)"; $fail++
    }
}
Write-Host "Done: $ok OK, $fail failed"
