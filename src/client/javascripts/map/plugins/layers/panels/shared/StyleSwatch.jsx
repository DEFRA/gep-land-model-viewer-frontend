import { swatchStyle } from './swatch-helpers.js'

/** @param {{ definition: import('./swatch-helpers.js').StyleDefinition, className?: string }} props */
export function StyleSwatch ({ definition, className = '' }) {
  const classes = ['app-map__style-swatch', className].filter(Boolean).join(' ')

  return <span className={classes} style={swatchStyle(definition)} aria-hidden='true' />
}
