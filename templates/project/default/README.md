# PDD Default Project Template

This is the default PDD project template.

## Directory Structure

```
project-root/
├── .pdd/
│   ├── config.yaml       # PDD configuration
│   ├── hooks.yaml        # Hook definitions
│   └── cache/            # Generated artifacts cache
├── docs/
│   ├── plans/            # Development plans
│   └── specs/            # Specification documents
├── specs/                # Feature specifications
├── src/                  # Source code
└── tests/                # Test files
```

## Quick Start

```bash
pdd init .
pdd list
pdd linter --type code prd sql activiti
```

## Configuration

Edit `.pdd/config.yaml` to customize PDD behavior for your project.
