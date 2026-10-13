import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginSvelte from 'eslint-plugin-svelte'

export default defineConfig(
  // vendor/qonlang 是千语集引擎的原样快照，按千语集自己的规矩检查过，这里不再管
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/out',
      '.cache/**',
      'src/renderer/src/vendor/**',
      'resources/speech/espeak/**'
    ]
  },
  tseslint.configs.recommended,
  eslintPluginSvelte.configs['flat/recommended'],
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser
      }
    }
  },
  {
    rules: {
      'svelte/prefer-svelte-reactivity': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }
      ]
    }
  },
  {
    files: ['tests/**', 'scripts/**', 'resources/speech/runner.mjs'],
    rules: { '@typescript-eslint/explicit-function-return-type': 'off' }
  },
  eslintConfigPrettier
)
