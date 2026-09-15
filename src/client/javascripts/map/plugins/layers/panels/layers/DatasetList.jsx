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
        aria-disabled={loading ? 'true' : undefined}
        aria-label={layer?.hidden ? `${dataset.label}, hidden` : undefined}
        onClick={event => {
          if (loading) {
            event.preventDefault()
          }
        }}
        onChange={onChange}
      />
      <label className='govuk-label govuk-checkboxes__label' htmlFor={`layer-${dataset.id}`}>
        <span className={layer?.hidden ? 'app-map__layers-label--hidden' : undefined}>{dataset.label}</span>
      </label>
    </div>
  )
}

export function DatasetList ({ datasets, layers, legend, onChange }) {
  return (
    <fieldset className='govuk-fieldset'>
      <legend className='govuk-visually-hidden'>{legend}</legend>
      <div className='govuk-checkboxes govuk-checkboxes--small app-map__dataset-list'>
        {datasets.map(dataset => (
          <DatasetCheckbox
            key={dataset.id}
            dataset={dataset}
            layer={layers.find(layer => layer.id === dataset.id)}
            onChange={event => onChange(dataset, event.currentTarget.checked)}
          />
        ))}
      </div>
    </fieldset>
  )
}
