import { getKeyEntries } from './key-entries.js'
import { StyleSwatch } from '../shared/StyleSwatch.jsx'

function WmsLegend ({ baseUrl, name }) {
  const label = name.replaceAll('_', ' ')
  const src = `${baseUrl}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic&LAYER=${encodeURIComponent(name)}&FORMAT=image/png`

  return (
    <div className='app-map__key-legend-row'>
      <span className='govuk-body-s govuk-!-margin-bottom-0'>{label}</span>
      <img className='app-map__key-legend' src={src} alt={`Legend for ${label}`} crossOrigin='anonymous' />
    </div>
  )
}

/** @param {{ definition: import('../shared/swatch-helpers.js').StyleDefinition }} props */
function StyleLegend ({ definition }) {
  return (
    <li className='app-map__key-style-row'>
      <StyleSwatch definition={definition} className='app-map__key-style-swatch' />
      <span className='govuk-body-s govuk-!-margin-bottom-0'>{definition.label}</span>
    </li>
  )
}

export function KeyPanel ({ pluginConfig, pluginState }) {
  const keyEntries = getKeyEntries(pluginConfig.datasets, pluginState)

  return (
    <div className='app-map__key-panel'>
      {keyEntries.length
        ? (
          <div className='app-map__key-grid'>
            {keyEntries.map(entry => (
              <div className='app-map__key-entry' key={entry.id}>
                <h3 className='im-e-heading-s govuk-!-margin-bottom-1'>{entry.label}</h3>
                {entry.type === 'style'
                  ? (
                    <ul className='app-map__key-styles'>
                      {entry.styles.map((style, index) => (
                        <StyleLegend definition={style} key={`${style.label}:${index}`} />
                      ))}
                    </ul>
                    )
                  : (
                    <div className='app-map__key-legends'>
                      {entry.layerNames.map(name => <WmsLegend baseUrl={entry.baseUrl} name={name} key={name} />)}
                    </div>
                    )}
              </div>
            ))}
          </div>
          )
        : <p className='govuk-body govuk-!-margin-bottom-0'>Enable data layers to view the key.</p>}
    </div>
  )
}
