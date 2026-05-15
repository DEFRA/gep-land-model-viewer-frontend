import neostandard from 'neostandard'
import globals from 'globals'

export default [
  ...neostandard({
    env: ['node', 'vitest'],
    ignores: [...neostandard.resolveIgnoresFromGitignore()],
    noJsx: true
  }),
  {
    files: ['src/client/**/*.js'],
    languageOptions: {
      globals: globals.browser
    }
  }
]
