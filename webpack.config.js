import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import CopyPlugin from 'copy-webpack-plugin'
import TerserPlugin from 'terser-webpack-plugin'
import { WebpackAssetsManifest } from 'webpack-assets-manifest'
import PreactRefreshPlugin from '@prefresh/webpack'

const { NODE_ENV = 'development' } = process.env
const isDevelopment = NODE_ENV === 'development'

if (isDevelopment && existsSync('.env')) {
  process.loadEnvFile('.env')
}

const appBaseUrl = new URL(process.env.APP_BASE_URL ?? 'http://localhost:3002')
const defaultDevPort = appBaseUrl.protocol === 'https:' ? '443' : '80'
const devPort = Number.parseInt(appBaseUrl.port || defaultDevPort, 10)
const backendPort = Number.parseInt(process.env.PORT ?? '3003', 10)

if (isDevelopment && devPort === backendPort) {
  throw new Error('APP_BASE_URL and PORT must use different ports: Webpack and Hapi run as separate development servers.')
}

const require = createRequire(import.meta.url)
const dirname = path.dirname(fileURLToPath(import.meta.url))

const govukFrontendPath = path.dirname(
  require.resolve('govuk-frontend/package.json')
)

const ruleTypeAssetResource = 'asset/resource'

export default {
  context: path.resolve(dirname, 'src/client'),
  entry: {
    application: {
      import: ['./javascripts/application.js', './stylesheets/application.scss']
    },
    map: {
      import: ['./javascripts/map/index.js', './stylesheets/map.scss']
    }
  },
  experiments: {
    outputModule: true
  },
  mode: NODE_ENV === 'production' ? 'production' : 'development',
  devtool: NODE_ENV === 'production' ? 'source-map' : 'inline-source-map',
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [fileURLToPath(import.meta.url)]
    }
  },
  watchOptions: {
    aggregateTimeout: 200,
    poll: 1000
  },
  devServer: {
    host: '0.0.0.0',
    port: devPort,
    server: appBaseUrl.protocol === 'https:' ? 'https' : 'http',
    allowedHosts: [appBaseUrl.hostname],
    hot: true,
    static: false,
    devMiddleware: {
      index: false,
      // Hapi reads the asset manifest from disk when rendering templates.
      writeToDisk: (filePath) => filePath.endsWith('assets-manifest.json')
    },
    proxy: [
      {
        context: () => true,
        target: `http://127.0.0.1:${backendPort}`
      }
    ],
    watchFiles: {
      paths: ['src/server/**/*.njk'],
      options: {
        usePolling: true,
        interval: 1000
      }
    }
  },
  output: {
    filename:
      NODE_ENV === 'production'
        ? 'javascripts/[name].[contenthash:7].min.js'
        : 'javascripts/[name].js',

    chunkFilename:
      NODE_ENV === 'production'
        ? 'javascripts/[name].[chunkhash:7].min.js'
        : 'javascripts/[name].js',

    path: path.join(dirname, '.public'),
    publicPath: '/public/',
    libraryTarget: 'module',
    module: true,
    clean: true
  },
  resolve: {
    alias: {
      '/public/assets': path.join(govukFrontendPath, 'dist/govuk/assets'),

      // Use Preact for React imports from interactive-map and local plugins.
      react: 'preact/compat',
      'react-dom': 'preact/compat'
    }
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|mjs|scss)$/,
        loader: 'source-map-loader',
        enforce: 'pre'
      },
      {
        test: /\.jsx?$/,
        // Prefresh injects module.hot into ESM. Production keeps strict ESM parsing;
        // missing exports are errors in both modes despite this parser difference.
        type: isDevelopment ? 'javascript/auto' : undefined,
        parser: { exportsPresence: 'error' },
        loader: 'babel-loader',
        exclude: /node_modules/,
        options: {
          browserslistEnv: 'javascripts',
          cacheDirectory: true,
          extends: path.join(dirname, 'babel.config.cjs'),
          presets: [['@babel/preset-env']],
          plugins: isDevelopment ? ['@prefresh/babel-plugin'] : []
        },

        // Flag loaded modules as side effect free
        sideEffects: false
      },
      {
        test: /\.css$/,
        type: 'asset/source'
      },
      {
        test: /\.scss$/,
        type: ruleTypeAssetResource,
        generator: {
          binary: false,
          filename:
            NODE_ENV === 'production'
              ? 'stylesheets/[name].[contenthash:7].min.css'
              : 'stylesheets/[name].css'
        },
        use: [
          'postcss-loader',
          {
            loader: 'sass-loader',
            options: {
              sassOptions: {
                loadPaths: [
                  path.join(dirname, 'src/client/stylesheets'),
                  path.join(dirname, 'src/server/common/components'),
                  path.join(dirname, 'src/server/common/templates/partials')
                ],
                quietDeps: true,
                sourceMapIncludeSources: true,
                style: 'expanded'
              },
              warnRuleAsWarning: true
            }
          }
        ]
      },
      {
        test: /\.(png|svg|jpe?g|gif)$/,
        type: ruleTypeAssetResource,
        generator: {
          filename: 'assets/images/[name][ext]'
        }
      },
      {
        test: /\.(ico)$/,
        type: ruleTypeAssetResource,
        generator: {
          filename: 'assets/images/[name][ext]'
        }
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: ruleTypeAssetResource,
        generator: {
          filename: 'assets/fonts/[name][ext]'
        }
      }
    ]
  },
  optimization: {
    minimize: NODE_ENV === 'production',
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          // Use webpack default compress options
          // https://webpack.js.org/configuration/optimization/#optimizationminimizer
          compress: { passes: 2 },

          // Allow Terser to remove @preserve comments
          format: { comments: false },

          // Include sources content from dependency source maps
          sourceMap: {
            includeSources: true
          },

          // Compatibility workarounds
          safari10: true
        }
      })
    ],

    // Skip bundling unused modules
    providedExports: true,
    sideEffects: true,
    usedExports: true
  },
  plugins: [
    ...(isDevelopment ? [new PreactRefreshPlugin()] : []),
    new WebpackAssetsManifest(),
    new CopyPlugin({
      patterns: [
        {
          from: path.join(govukFrontendPath, 'dist/govuk/assets'),
          to: 'assets'
        },
        {
          from: path.join(dirname, 'src/client/images'),
          to: 'images'
        },
        {
          from: path.join(dirname, 'node_modules/@defra/interactive-map/dist/css/index.css'),
          to: 'stylesheets/vendor/interactive-map.css'
        },
        {
          from: path.join(dirname, 'node_modules/@defra/interactive-map/plugins/beta/map-styles/dist/css/index.css'),
          to: 'stylesheets/vendor/interactive-map-styles.css'
        },
        {
          from: path.join(dirname, 'node_modules/@defra/interactive-map/plugins/search/dist/css/index.css'),
          to: 'stylesheets/vendor/interactive-map-search.css'
        },
        {
          from: path.join(dirname, 'node_modules/@defra/interactive-map/plugins/beta/scale-bar/dist/css/index.css'),
          to: 'stylesheets/vendor/interactive-map-scale-bar.css'
        },
        {
          from: path.join(dirname, 'src/client/data/vts'),
          to: 'data/vts'
        }
      ]
    })
  ],
  stats: {
    errorDetails: true,
    loggingDebug: ['sass-loader'],
    preset: 'minimal'
  },
  target: 'browserslist:javascripts'
}
