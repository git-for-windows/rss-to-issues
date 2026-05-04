import neostandard from 'neostandard'
import vitest from '@vitest/eslint-plugin'

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  ...neostandard(),
  {
    ...vitest.configs.recommended,
    files: ['__tests__/**/*.js'],
    languageOptions: {
      globals: vitest.environments.env.globals
    }
  }
]
