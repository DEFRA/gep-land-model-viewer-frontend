import neostandard from 'neostandard'
import globals from 'globals'

export default [
  ...neostandard({
    env: ['node', 'vitest'],
    ignores: [...neostandard.resolveIgnoresFromGitignore()]
  }),
  {
    files: ['src/client/**/*.{js,jsx}'],
    languageOptions: {
      globals: globals.browser
    }
  }
]
