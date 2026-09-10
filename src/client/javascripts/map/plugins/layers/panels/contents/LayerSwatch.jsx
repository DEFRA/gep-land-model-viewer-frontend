import { rgbaString } from '../../../../config/colours.js'
import { StyleSwatch } from '../shared/StyleSwatch.jsx'

function ColourGrid ({ colours }) {
  return colours.map(colour => (
    <span
      className='app-map__contents-swatch-cell'
      style={{ backgroundColor: rgbaString(colour) }}
      key={colour.join(',')}
    />
  ))
}

function lineStyle (colour, width, directions) {
  const halfWidth = width / 2
  const start = `calc(50% - ${halfWidth}px)`
  const end = `calc(50% + ${halfWidth}px)`
  const gradient = direction => `linear-gradient(to ${direction}, transparent ${start}, ${colour} ${start}, ${colour} ${end}, transparent ${end})`

  return { backgroundImage: directions.map(gradient).join(', ') }
}

function colourGridStyle (colourCount) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(colourCount)))

  return {
    '--app-map-contents-swatch-columns': columns,
    '--app-map-contents-swatch-rows': Math.max(1, Math.ceil(colourCount / columns))
  }
}

/** @param {{ swatch: import('./contents-entries.js').ContentsSwatch }} props */
export function LayerSwatch ({ swatch }) {
  const className = 'app-map__style-swatch app-map__contents-swatch'

  switch (swatch.type) {
    case 'style':
      return <StyleSwatch definition={swatch.definition} className='app-map__contents-swatch' />
    case 'colours':
      return (
        <span
          className={`${className} app-map__contents-swatch--colour-grid`}
          style={colourGridStyle(swatch.colours.length)}
          aria-hidden='true'
        >
          <ColourGrid colours={swatch.colours} />
        </span>
      )
    case 'line':
      return (
        <span
          className={className}
          style={lineStyle(swatch.colour, swatch.width, swatch.directions)}
          aria-hidden='true'
        />
      )
    case 'wms':
      return <span className={`${className} app-map__contents-swatch--wms`} aria-hidden='true' />
    default:
      return null
  }
}
