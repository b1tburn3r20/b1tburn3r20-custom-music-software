import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Components must use theme tokens (bg-background, text-muted-foreground, text-like…),
// never raw palette colors, hex or rgb() values. See src/styles/themes.css.
const PALETTE = String.raw`\b(?:text|bg|border|from|via|to|ring|fill|stroke|shadow|outline|decoration|placeholder|caret|accent|divide)-(?:red|white|black|gray|zinc|slate|neutral|stone|indigo|sky|blue|amber|emerald|green|fuchsia|purple|pink|orange|yellow|rose|violet|teal|cyan|lime)\b`
const RAW = String.raw`#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*\d|\bhsla?\(\s*\d`
const message = 'Use a theme token (see src/styles/themes.css) instead of a hardcoded color.'

export default defineConfig([
  globalIgnores(['dist', 'release', 'node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ['src/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: `Literal[value=/${PALETTE}/]`, message },
        { selector: `TemplateElement[value.raw=/${PALETTE}/]`, message },
        { selector: `Literal[value=/${RAW}/]`, message },
        { selector: `TemplateElement[value.raw=/${RAW}/]`, message },
      ],
    },
  },
])
