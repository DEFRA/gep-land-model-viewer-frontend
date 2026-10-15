import { Info } from 'lucide-preact'
import { CheckboxError } from './CheckboxError.jsx'

const FAILED_MESSAGE = 'This dataset could not be added. Try again later.'

function DatasetCheckbox ({ dataset, layer, failed, onChange }) {
  const loading = Boolean(layer && !layer.ready)
  const errorId = failed ? `layer-${dataset.id}-error` : undefined

  return (
    <div className='govuk-checkboxes__item' aria-busy={loading ? 'true' : undefined}>
      <input
        className='govuk-checkboxes__input'
        id={`layer-${dataset.id}`}
        type='checkbox'
        value={dataset.id}
        checked={Boolean(layer)}
        aria-describedby={errorId}
        aria-disabled={loading ? 'true' : undefined}
        aria-label={layer?.hidden ? `${dataset.title}, hidden` : undefined}
        onClick={event => {
          if (loading) {
            event.preventDefault()
          }
        }}
        onChange={onChange}
      />
      <label className='govuk-label govuk-checkboxes__label' htmlFor={`layer-${dataset.id}`}>
        <span className={layer?.hidden ? 'app-map__layers-label--hidden' : undefined}>{dataset.title}</span>
      </label>
      {errorId && <CheckboxError id={errorId}>{FAILED_MESSAGE}</CheckboxError>}
    </div>
  )
}

export function DatasetList ({ datasets, layers, failedLayerIds, legend, onChange, onInfo }) {
  return (
    <fieldset className='govuk-fieldset'>
      <legend className='govuk-visually-hidden'>{legend}</legend>
      <div className='govuk-checkboxes govuk-checkboxes--small app-map__dataset-list'>
        {datasets.map(dataset => (
          <div className='app-map__layer-row' key={dataset.id}>
            <DatasetCheckbox
              dataset={dataset}
              layer={layers.find(layer => layer.id === dataset.id)}
              failed={failedLayerIds.includes(dataset.id)}
              onChange={event => onChange(dataset, event.currentTarget.checked)}
            />
            <button
              type='button'
              id={`dataset-info-${dataset.id}`}
              className='im-c-map-button app-map__layer-info-button'
              aria-label={`About ${dataset.title}`}
              aria-haspopup='dialog'
              onClick={event => onInfo(dataset, event.currentTarget)}
            >
              <Info size={24} aria-hidden='true' />
            </button>
          </div>
        ))}
      </div>
    </fieldset>
  )
}
