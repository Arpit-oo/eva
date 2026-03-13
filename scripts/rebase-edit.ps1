param([string]$todoFile)
$content = Get-Content $todoFile -Raw
$content = $content -replace '(?m)^pick fa273d7', 'edit fa273d7'
Set-Content -Path $todoFile -Value $content -NoNewline
