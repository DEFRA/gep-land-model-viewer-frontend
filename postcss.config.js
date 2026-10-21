import autoprefixer from 'autoprefixer'
import cssnano from 'cssnano'

export default {
  plugins: [
    // Add vendor prefixes
    autoprefixer({
      env: 'stylesheets'
    }),

    // Apply CSS optimisations
    cssnano({
      preset: ['default', {
        env: 'stylesheets'
      }]
    })
  ]
}
