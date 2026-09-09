import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  oxc: {
    jsx: {
      runtime: 'automatic',
      importSource: 'preact'
    }
  },
  resolve: {
    alias: {
      react: 'preact/compat',
      'react-dom': 'preact/compat'
    }
  },
  test: {
    globals: true,
    environment: 'node',
    clearMocks: true,
    deps: {
      optimizer: {
        client: {
          enabled: true,
          include: [
            'preact',
            'preact/compat',
            'preact/hooks',
            'lucide-preact',
            '@testing-library/preact',
            '@base-ui/react/menu'
          ]
        }
      }
    },
    server: {
      deps: {
        // UI dependencies must resolve through our Preact aliases.
        // Inline OpenLayers too so its class identities stay consistent with optimisation enabled.
        inline: [/@dnd-kit/, /@base-ui/, /use-sync-external-store/, 'ol']
      }
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        ...configDefaults.exclude,
        'src/client/stylesheets/**',
        '.public',
        'coverage',
        'postcss.config.js',
        'stylelint.config.js',
        'vitest.config.js',
        '.sonarlint',
        'babel.config.cjs'
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 90
      }
    }
  }
})
