# E2E Test Runner - Inspection System (PC + H5)
# Runs cases in dependency order: base data -> point -> H5 scan -> PC record/abnormal/stats
#
# Usage:
#   pwsh run-inspect-tests.ps1                    # run all
#   pwsh run-inspect-tests.ps1 -SkipH5            # PC only
#   pwsh run-inspect-tests.ps1 -Only pc-004-template-detail
#   pwsh run-inspect-tests.ps1 -Python "C:/Python314/python.exe"

param(
    [string]$Python = "python",
    [switch]$SkipH5,
    [string]$Only = ""
)

$ErrorActionPreference = "Continue"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projRoot  = Split-Path -Parent (Split-Path -Parent $scriptDir)   # Inspection-System-Project
$testDir   = Join-Path $projRoot "testcases/inspect"
$runner    = Join-Path (Split-Path -Parent $projRoot) "tests/testcase-ai.py"

if (-not (Test-Path $runner)) {
    Write-Host "[ERROR] runner not found: $runner" -ForegroundColor Red
    exit 1
}

Write-Host "Runner : $runner"
Write-Host "Cases  : $testDir"
Write-Host ("-" * 70)

# Dependency check (pyyaml + mcp are required by testcase-ai.py)
& $Python -c "import yaml, mcp" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Missing python deps. Install first:" -ForegroundColor Red
    Write-Host "        $Python -m pip install pyyaml mcp"
    exit 1
}

# Static validation first: fast, no browser needed
Write-Host "`n[1/2] Static validation" -ForegroundColor Cyan
& $Python (Join-Path $scriptDir "validate-cases.py") $testDir
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ABORT] Fix validation errors before running E2E." -ForegroundColor Red
    exit 1
}

# Execution order matters: later cases depend on data produced by earlier ones
$order = @(
    "pc/pc-001-login",
    "pc/pc-002-room-crud",
    "pc/pc-003-area-crud",
    "pc/pc-004-template-detail",
    "pc/pc-005-point-crud",
    "pc/pc-006-point-qrcode",
    "pc/pc-007-point-import",
    "h5/h5-001-scan-normal",
    "h5/h5-003-duplicate-reject",
    "h5/h5-002-abnormal-submit",
    "pc/pc-008-record-query-remark",
    "pc/pc-009-record-supplement",
    "pc/pc-010-abnormal-process",
    "pc/pc-011-stats"
)

if ($SkipH5) { $order = $order | Where-Object { $_ -notlike "h5/*" } }
if ($Only)   { $order = $order | Where-Object { $_ -like "*$Only*" } }

Write-Host "`n[2/2] E2E execution" -ForegroundColor Cyan
$passed = @(); $failed = @()

foreach ($item in $order) {
    $yaml = Join-Path $testDir "$item.yaml"
    if (-not (Test-Path $yaml)) {
        Write-Host "[SKIP] $item (file not found)" -ForegroundColor Yellow
        continue
    }
    Write-Host "`n>>> $item" -ForegroundColor White
    & $Python $runner $yaml
    if ($LASTEXITCODE -eq 0) { $passed += $item } else { $failed += $item }
}

Write-Host ("`n" + "=" * 70)
Write-Host "PASSED ($($passed.Count)):" -ForegroundColor Green
$passed | ForEach-Object { Write-Host "  + $_" }
if ($failed.Count -gt 0) {
    Write-Host "FAILED ($($failed.Count)):" -ForegroundColor Red
    $failed | ForEach-Object { Write-Host "  - $_" }
}
Write-Host "=" * 70
Write-Host "Reports: tests/reports/"
