import { useEffect } from 'react'
import { Layers as LayersIcon } from 'lucide-preact'
import { LandSummary } from './LandSummary.jsx'
import { LayerSearch } from './LayerSearch.jsx'

const NO_MATCH_MESSAGE = 'No layers match your search.'

function DatasetCheckbox ({ dataset, layer, onChange }) {
  const loading = Boolean(layer && !layer.ready)

  return (
    <div className='govuk-checkboxes__item' aria-busy={loading ? 'true' : undefined}>
      <input
        className='govuk-checkboxes__input'
        id={`layer-${dataset.id}`}
        type='checkbox'
        value={dataset.id}
        checked={Boolean(layer)}
        disabled={loading}
        aria-label={layer?.hidden ? `${dataset.label}, hidden` : undefined}
        onChange={onChange}
      />
      <label className='govuk-label govuk-checkboxes__label' htmlFor={`layer-${dataset.id}`}>
        <span className={layer?.hidden ? 'app-map__layers-label--hidden' : undefined}>{dataset.label}</span>
      </label>
    </div>
  )
}

export function LayersPanel ({ pluginConfig, pluginState, services }) {
  const { datasets } = pluginConfig
  const { dispatch } = pluginState
  const { layers, query } = /** @type {import('../../reducer.js').LayersState} */ (pluginState)
  const { announce } = services
  const sorted = [...datasets].sort((a, b) => a.label.localeCompare(b.label))

  const term = query.trim().toLowerCase()
  const matching = term ? sorted.filter(dataset => dataset.label.toLowerCase().includes(term)) : sorted

  useEffect(() => {
    if (term && matching.length === 0) {
      announce(NO_MATCH_MESSAGE)
    }
  }, [term, matching.length, announce])

  const handleDatasetChange = (dataset, enabled) => {
    if (!enabled) {
      dispatch({ type: 'REMOVE_LAYER', payload: { id: dataset.id } })
      return
    }

    dispatch({ type: 'DATASET_LOADING', payload: { id: dataset.id } })
  }

  const handleSummaryChange = (id, enabled) => {
    dispatch({
      type: 'SET_SUMMARY',
      payload: { id, enabled }
    })
  }

  return (
    <div className='app-map__layers-content'>
      <h2 className='app-map__layers-header'>
        <LayersIcon className='app-map__layers-header-icon' />
        Layers
      </h2>
      <div className='app-map__layers-scroll'>
        <LandSummary layers={layers} onChange={handleSummaryChange} />

        <h3 className='govuk-heading-s govuk-!-margin-bottom-2'>Datasets</h3>
        <p className='govuk-body govuk-!-margin-bottom-4'>Add datasets to the map.</p>

        <LayerSearch
          query={query}
          onSearch={nextQuery => dispatch({ type: 'SET_QUERY', payload: nextQuery })}
        />

        <div data-app-layer-empty className='govuk-body govuk-hint' hidden={matching.length > 0}>
          {NO_MATCH_MESSAGE}
        </div>

        <fieldset className='govuk-fieldset'>
          <legend className='govuk-visually-hidden'>Data layers</legend>
          <div className='govuk-checkboxes govuk-checkboxes--small' id='layers-list' data-app-layer-list>
            {matching.map(dataset => (
              <DatasetCheckbox
                key={dataset.id}
                dataset={dataset}
                layer={layers.find(layer => layer.id === dataset.id)}
                onChange={event => handleDatasetChange(dataset, event.currentTarget.checked)}
              />
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  )
}
