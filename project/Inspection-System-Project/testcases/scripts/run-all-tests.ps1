# E2E Test Runner - All Tests

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir

Write-Host "Running all E2E tests..."
& pwsh "$scriptDir/run-backend-tests.ps1"
& pwsh "$scriptDir/run-frontend-tests.ps1"
Write-Host "All tests completed."
