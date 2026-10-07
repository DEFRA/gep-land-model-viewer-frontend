import { fileURLToPath } from 'node:url'
import { NodePackageImporter } from 'sass-embedded'
import { mergeConfig } from 'vite'

const projectPath = path => fileURLToPath(new URL(path, import.meta.url))

/** @type {import('@storybook/preact-vite').StorybookConfig} */
export default {
  stories: ['../src/client/**/*.stories.@(js|jsx)'],
  framework: '@storybook/preact-vite',
  addons: ['@storybook/addon-a11y'],
  core: {
    disableTelemetry: true,
    disableWhatsNewNotifications: true
  },
  staticDirs: [
    { from: '../node_modules/govuk-frontend/dist/govuk/assets', to: '/public/assets' }
  ],
  features: {
    changeDetection: false,
    sidebarOnboardingChecklist: false
  },
  viteFinal: config => mergeConfig(config, {
    oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
    server: { watch: { ignored: ['**/coverage/**'] } },
    optimizeDeps: {
      include: ['preact', 'preact/jsx-dev-runtime']
    },
    resolve: {
      alias: { react: 'preact/compat', 'react-dom': 'preact/compat' }
    },
    css: {
      preprocessorOptions: {
        scss: {
          loadPaths: [
            projectPath('../src/client/stylesheets'),
            projectPath('../src/server/common/components'),
            projectPath('../src/server/common/templates/partials')
          ],
          importers: [new NodePackageImporter()],
          quietDeps: true
        }
      }
    }
  })
}
