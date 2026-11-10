$stale = "app/api/google/gmail/send/route.ts"

if (Test-Path $stale) {
    Remove-Item $stale -Force
    Write-Host "Deleted stale route: $stale"
} else {
    Write-Host "Stale route not found: $stale"
}

Write-Host ""
Write-Host "Replace components/influencer-table.tsx with the file from this package."
Write-Host "Then run: npm run build"
