param(
    [Parameter(Mandatory = $true)][string]$SkillRoot,
    [switch]$Apply
)
$ErrorActionPreference = 'Stop'
$resolvedRoot = (Resolve-Path -LiteralPath $SkillRoot).Path.TrimEnd([System.IO.Path]::DirectorySeparatorChar)
$changes = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'skill-approval-updates.json') -Raw | ConvertFrom-Json
$pending = @()
foreach ($change in $changes) {
    $target = (Resolve-Path -LiteralPath (Join-Path $resolvedRoot $change.path)).Path
    if (-not $target.StartsWith($resolvedRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'Skill target escapes the supplied skill root'
    }
    $content = [System.IO.File]::ReadAllText($target)
    if ($content.Contains($change.after)) {
        Write-Output ('Already updated: ' + $change.path)
        continue
    }
    if (-not $content.Contains($change.before)) { throw ('Skill has changed; review the patch before updating ' + $change.path) }
    $pending += [pscustomobject]@{ target = $target; relative = $change.path; original = $content; updated = $content.Replace($change.before, $change.after) }
}
if (-not $Apply) {
    $pending | ForEach-Object { Write-Output ('Would update: ' + $_.relative) }
    Write-Output 'Preview only. Use -Apply to write these changes.'
    exit 0
}
if ($pending.Count -eq 0) { exit 0 }
$backupRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('quaysight-skill-backup-' + [guid]::NewGuid().ToString('N'))
$null = New-Item -ItemType Directory -Path $backupRoot
foreach ($item in $pending) {
    $backupFile = Join-Path $backupRoot ($item.relative.Replace('/', '_'))
    [System.IO.File]::WriteAllText($backupFile, $item.original, [System.Text.UTF8Encoding]::new($false))
    [System.IO.File]::WriteAllText($item.target, $item.updated, [System.Text.UTF8Encoding]::new($false))
    if ([System.IO.File]::ReadAllText($item.target) -cne $item.updated) { throw ('Skill write verification failed: ' + $item.relative) }
    Write-Output ('Updated: ' + $item.relative)
}
Write-Output ('Original skill files backed up to ' + $backupRoot)
