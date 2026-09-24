# Frontend Project Template for PDD

## Technology Stack

- Vue 3 / React
- TypeScript (recommended)
- Vite / Webpack
- ESLint + Prettier

## PDD Configuration for Frontend Projects

Recommended linters:

- **ESLint**: JavaScript/TypeScript code quality
- **Stylelint**: CSS/SCSS style checking
- **HTML validation**: Markup standards

## Directory Structure

```
frontend-project/
├── src/
│   ├── components/
│   ├── views/ or pages/
│   ├── stores/ or hooks/
│   ├── utils/
│   ├── api/
│   ├── assets/
│   └── styles/
├── public/
├── config/
│   └── eslint.config.js
├── package.json
├── vite.config.ts or webpack.config.js
└── tsconfig.json
```

## Integration with PDD

```bash
# Initialize with frontend template
pdd init . -t frontend

# Run frontend-specific linters
pdd linter -t code
```
