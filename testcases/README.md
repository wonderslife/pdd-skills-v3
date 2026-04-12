# E2E Test Cases

## Structure

```
testcases/
├── backend/              # Backend API tests
├── frontend/            # Frontend E2E tests
├── shared/              # Shared test data
├── reports/             # Test reports
└── scripts/             # Test runner scripts
```

## Running Tests

```bash
# All tests
pwsh scripts/run-all-tests.ps1

# Backend only
pwsh scripts/run-backend-tests.ps1

# Frontend only
pwsh scripts/run-frontend-tests.ps1
```
