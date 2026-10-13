// ESLint flat config: React + hooks for the browser bundle (src/), Node for the serverless API and scripts.
import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '.vercel/**', 'Skills/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx,ts}'],
    languageOptions: { globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true } } },
    settings: { react: { version: 'detect' } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      'react/prop-types': 'off', // plain JS components; props are documented where they are defined
      'react/no-unescaped-entities': 'off', // copy uses real apostrophes and quotes on purpose
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['src/**/*.ts'],
    extends: [tseslint.configs.recommended],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    files: ['api/**/*.js', 'scripts/**/*.{js,mjs}', 'vite.config.js', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{js,jsx,mjs}'],
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true }],
    },
  },
)
