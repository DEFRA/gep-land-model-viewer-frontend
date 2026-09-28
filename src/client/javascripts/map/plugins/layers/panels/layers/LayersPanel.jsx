import { useEffect, useRef } from 'react'
import { ChevronRight, Layers as LayersIcon } from 'lucide-preact'
import { LinkButton } from '../../../../components/LinkButton.jsx'
import { DatasetList } from './DatasetList.jsx'
import { LandSummary } from './LandSummary.jsx'
import { LayerSearch } from './LayerSearch.jsx'
import { DATASET_INFO_PANEL_ID } from '../../constants.js'

function noMatchMessageFor ({ status, results, query }) {
  if (status !== 'ready' || results.length) {
    return ''
  }

  const term = query.trim()
  return term ? `No datasets match "${term}"` : 'No datasets are available.'
}

function themeCount (selected, total) {
  if (selected) {
    return `${selected} of ${total} selected`
  }

  const noun = total === 1 ? 'dataset' : 'datasets'
  return <>{total}<span className='govuk-visually-hidden'> {noun}</span></>
}

export function LayersPanel ({ pluginConfig, pluginState, services, appState }) {
  const { dispatch } = pluginState
  const { catalogue, layers } = /** @type {import('../../reducer.js').LayersState} */ (pluginState)
  const { query, results, expandedThemes } = catalogue
  const { announce } = services
  const searchInputRef = useRef(null)
  const datasetThemes = [...new Set(results.map(dataset => dataset.inspireTheme))].sort((a, b) => a.localeCompare(b))

  const term = query.trim()
  const noMatchMessage = noMatchMessageFor(catalogue)

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

    dispatch({ type: 'DATASET_LOADING', payload: { id: dataset.id, title: dataset.title } })
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
        props: { datasetId: dataset.id, title: dataset.title, triggeringElement }
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

        <div id='layers-list' data-app-layer-list aria-busy={catalogue.status === 'loading'}>
          {catalogue.status === 'loading' && <p className='govuk-body govuk-hint govuk-!-margin-bottom-4'><output>Loading datasets…</output></p>}
          {catalogue.status === 'error' && (
            <p className='govuk-body govuk-!-margin-bottom-4' role='alert'>
              Datasets could not be loaded.{' '}
              <LinkButton onClick={() => dispatch({ type: 'RETRY_CATALOGUE' })}>Try again</LinkButton>
            </p>
          )}
          <p data-app-layer-empty className='govuk-body govuk-hint govuk-!-margin-bottom-4' hidden={!noMatchMessage}>
            {noMatchMessage}
          </p>

          {term
            ? results.length > 0 && (
              <DatasetList datasets={results} layers={layers} legend='Search results' onChange={handleDatasetChange} onInfo={handleDatasetInfo} />
            )
            : datasetThemes.map(datasetTheme => {
              const themeDatasets = results.filter(dataset => dataset.inspireTheme === datasetTheme)
              const selectedCount = themeDatasets.filter(dataset => layers.some(layer => layer.id === dataset.id)).length

              return (
                <details
                  key={datasetTheme}
                  className='govuk-details app-map__dataset-theme'
                  open={expandedThemes.includes(datasetTheme)}
                  onToggle={event => dispatch({
                    type: 'SET_DATASET_THEME_EXPANDED',
                    payload: { datasetTheme, expanded: event.currentTarget.open }
                  })}
                >
                  <summary className='govuk-details__summary' tabIndex={0}>
                    <ChevronRight className='app-map__dataset-theme-chevron' size={16} aria-hidden='true' />
                    <span className='govuk-details__summary-text'>{datasetTheme}</span>
                    <span className='app-map__dataset-theme-count'>
                      {themeCount(selectedCount, themeDatasets.length)}
                    </span>
                  </summary>
                  <div className='govuk-details__text'>
                    <DatasetList datasets={themeDatasets} layers={layers} legend={datasetTheme} onChange={handleDatasetChange} onInfo={handleDatasetInfo} />
                  </div>
                </details>
              )
            })}

          {catalogue.status === 'ready' && results.length < catalogue.total && (
            <p className='govuk-body-s govuk-hint govuk-!-margin-top-2' data-app-layer-limit>
              Showing {results.length} of {catalogue.total} datasets. Search to find others.
            </p>
          )}
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
