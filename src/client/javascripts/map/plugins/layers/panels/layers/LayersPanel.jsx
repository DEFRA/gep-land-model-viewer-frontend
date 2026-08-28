import { useEffect } from 'react'
import { LAYERS_ICON } from '../../icons.js'
import { InlineIcon } from '../../../../components/InlineIcon.jsx'
import { LandSummary } from './LandSummary.jsx'
import { LayerSearch } from './LayerSearch.jsx'
import { toggleDataset } from '../../datasets/layer-manager.js'

const NO_MATCH_MESSAGE = 'No layers match your search.'

/**
 * @param {{ dataset: { id: string, label: string }, state?: import('../../reducer.js').DatasetState, onChange: (event: import('preact').TargetedEvent<HTMLInputElement>) => void }} props
 */
function DatasetCheckbox ({ dataset, state = {}, onChange }) {
  return (
    <div className='govuk-checkboxes__item' aria-busy={state.loading ? 'true' : undefined}>
      <input
        className='govuk-checkboxes__input'
        id={`layer-${dataset.id}`}
        type='checkbox'
        value={dataset.id}
        checked={Boolean(state.visible)}
        disabled={Boolean(state.loading)}
        onChange={onChange}
      />
      <label className='govuk-label govuk-checkboxes__label' htmlFor={`layer-${dataset.id}`}>
        {dataset.label}
      </label>
    </div>
  )
}

export function LayersPanel ({ mapProvider, pluginConfig, pluginState, services }) {
  const { datasets } = pluginConfig
  const { dispatch } = pluginState
  const { datasets: datasetStates, summaries, query } = /** @type {import('../../reducer.js').LayersState} */ (pluginState)
  const inspectionRef = pluginState.useRef('inspection')
  const { announce } = services
  const sorted = [...datasets].sort((a, b) => a.label.localeCompare(b.label))

  const term = query.trim().toLowerCase()
  const matching = term ? sorted.filter(dataset => dataset.label.toLowerCase().includes(term)) : sorted

  useEffect(() => {
    if (term && matching.length === 0) {
      announce(NO_MATCH_MESSAGE)
    }
  }, [term, matching.length, announce])

  const handleDatasetChange = async (dataset, visible) => {
    const { id } = dataset

    dispatch({
      type: 'SET_DATASET_LOADING',
      payload: { id, visible }
    })

    const result = await toggleDataset(mapProvider.map, dataset, visible)
    dispatch({
      type: 'SET_DATASET_STATE',
      payload: { id, ...result }
    })
    inspectionRef.current?.reconcile()
  }

  const handleSummaryChange = (id, visible) => {
    dispatch({
      type: 'SET_SUMMARY',
      payload: { id, visible }
    })
  }

  return (
    <div className='app-map__layers-content'>
      <h2 className='app-map__layers-header'>
        <InlineIcon className='app-map__layers-header-icon' content={LAYERS_ICON} />
        Layers
      </h2>
      <div className='app-map__layers-scroll'>
        <LandSummary summaries={summaries} onChange={handleSummaryChange} />

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
                state={datasetStates[dataset.id]}
                onChange={event => handleDatasetChange(dataset, event.currentTarget.checked)}
              />
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  )
}
