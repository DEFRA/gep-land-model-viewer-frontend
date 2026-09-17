import { useEffect, useRef } from 'react'
import { ChevronRight, Layers as LayersIcon } from 'lucide-preact'
import { LinkButton } from '../../../../components/LinkButton.jsx'
import { DatasetList } from './DatasetList.jsx'
import { LandSummary } from './LandSummary.jsx'
import { LayerSearch } from './LayerSearch.jsx'
import { DATASET_INFO_PANEL_ID } from '../../constants.js'

export function LayersPanel ({ pluginConfig, pluginState, services, appState }) {
  const { datasets } = pluginConfig
  const { dispatch } = pluginState
  const { layers, query, expandedDatasetThemes } = /** @type {import('../../reducer.js').LayersState} */ (pluginState)
  const { announce } = services
  const searchInputRef = useRef(null)
  const sorted = [...datasets].sort((a, b) => a.label.localeCompare(b.label))
  const datasetThemes = [...new Set(sorted.map(dataset => dataset.inspireTheme))].sort((a, b) => a.localeCompare(b))

  const term = query.trim().toLowerCase()
  const matching = term ? sorted.filter(dataset => dataset.label.toLowerCase().includes(term)) : sorted
  const noMatchMessage = term && matching.length === 0 ? `No datasets match "${query.trim()}"` : ''

  useEffect(() => {
    if (noMatchMessage) {
      announce(noMatchMessage)
    }
  }, [noMatchMessage, announce])

  const handleClearSearch = () => {
    dispatch({ type: 'SET_QUERY', payload: '' })
    searchInputRef.current.focus()
  }

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

  const handleDatasetInfo = (dataset, triggeringElement) => {
    appState.dispatch({
      type: 'OPEN_PANEL',
      payload: {
        panelId: DATASET_INFO_PANEL_ID,
        props: { datasetId: dataset.id, triggeringElement }
      }
    })
  }

  return (
    <div className='app-map__layers-content'>
      <h2 className='app-map__layers-header'>
        <LayersIcon className='app-map__layers-header-icon' size={24} />
        Layers
      </h2>
      <div className='app-map__layers-scroll'>
        <LandSummary layers={layers} onChange={handleSummaryChange} styleNonce={pluginConfig.styleNonce} />

        <h3 className='govuk-heading-s govuk-!-margin-bottom-2'>Datasets</h3>
        <p className='govuk-body-s app-map__layers-description govuk-!-margin-bottom-4'>Add datasets to the map.</p>

        <LayerSearch
          query={query}
          onSearch={nextQuery => dispatch({ type: 'SET_QUERY', payload: nextQuery })}
          onClear={handleClearSearch}
          inputRef={searchInputRef}
        />

        <div id='layers-list' data-app-layer-list>
          <p data-app-layer-empty className='govuk-body govuk-hint govuk-!-margin-bottom-4' hidden={!noMatchMessage}>
            {noMatchMessage}
          </p>

          {term
            ? matching.length > 0 && (
              <DatasetList datasets={matching} layers={layers} legend='Search results' onChange={handleDatasetChange} onInfo={handleDatasetInfo} />
            )
            : datasetThemes.map(datasetTheme => {
              const themeDatasets = sorted.filter(dataset => dataset.inspireTheme === datasetTheme)
              const selectedCount = themeDatasets.filter(dataset => layers.some(layer => layer.id === dataset.id)).length

              return (
                <details
                  key={datasetTheme}
                  className='govuk-details app-map__dataset-theme'
                  open={expandedDatasetThemes.includes(datasetTheme)}
                  onToggle={event => dispatch({
                    type: 'SET_DATASET_THEME_EXPANDED',
                    payload: { datasetTheme, expanded: event.currentTarget.open }
                  })}
                >
                  <summary className='govuk-details__summary' tabIndex={0}>
                    <ChevronRight className='app-map__dataset-theme-chevron' size={16} aria-hidden='true' />
                    <span className='govuk-details__summary-text'>{datasetTheme}</span>
                    <span className='app-map__dataset-theme-count'>
                      {selectedCount
                        ? `${selectedCount} of ${themeDatasets.length} selected`
                        : <>{themeDatasets.length}<span className='govuk-visually-hidden'> {themeDatasets.length === 1 ? 'dataset' : 'datasets'}</span></>}
                    </span>
                  </summary>
                  <div className='govuk-details__text'>
                    <DatasetList datasets={themeDatasets} layers={layers} legend={datasetTheme} onChange={handleDatasetChange} onInfo={handleDatasetInfo} />
                  </div>
                </details>
              )
            })}
        </div>

        {term && (
          <div className='app-map__clear-layer-search'>
            <LinkButton onClick={handleClearSearch}>Clear search</LinkButton>
          </div>
        )}
      </div>
    </div>
  )
}
