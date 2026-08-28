import { getKeyEntries } from './key-entries.js'

function Legend ({ baseUrl, name }) {
  const label = name.replaceAll('_', ' ')
  const src = `${baseUrl}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic&LAYER=${encodeURIComponent(name)}&FORMAT=image/png`

  return (
    <div className='app-map__key-legend-row'>
      <span className='govuk-body-s govuk-!-margin-bottom-0'>{label}</span>
      <img className='app-map__key-legend' src={src} alt={`Legend for ${label}`} crossOrigin='anonymous' />
    </div>
  )
}

export function KeyPanel ({ mapProvider, pluginConfig }) {
  const keyEntries = getKeyEntries(mapProvider.map, pluginConfig.datasets)

  return (
    <div className='app-map__key-panel'>
      {keyEntries.length
        ? (
          <div className='app-map__key-grid'>
            {keyEntries.map(({ label, layerNames, baseUrl }) => (
              <div className='app-map__key-entry' key={`${baseUrl}:${layerNames.join(',')}`}>
                <h3 className='govuk-heading-xs govuk-!-margin-bottom-1'>{label}</h3>
                <div className='app-map__key-legends'>
                  {layerNames.map(name => <Legend baseUrl={baseUrl} name={name} key={name} />)}
                </div>
              </div>
            ))}
          </div>
          )
        : <p className='govuk-body govuk-!-margin-bottom-0'>Enable data layers to view the key.</p>}
    </div>
  )
}
