export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.pdd/**', '**/coverage/**'],
    files: ['**/*.{js,mjs,cjs,jsx,vue,ts,tsx}']
  },

  {
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      'no-var': 'error',
      'prefer-const': 'warn',
      'eqeqeq': ['warn', 'always'],
      'curly': ['warn', 'multi-line'],

      'complexity': ['warn', { max: 15 }],
      'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],
      'max-depth': ['warn', { max: 4 }],
      'max-params': ['warn', { max: 5 }],
      'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],

      'padding-line-between-statements': [
        'warn',
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
        { blankLine: 'any', prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] }
      ]
    }
  },

  {
    files: ['**/*.vue'],
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/no-unused-components': 'warn'
    }
  },

  {
    files: ['**/*.test.{js,ts}', '**/*.spec.{js,ts}'],
    rules: {
      'no-unused-vars': 'off',
      'max-lines-per-function': 'off'
    }
  }
];
