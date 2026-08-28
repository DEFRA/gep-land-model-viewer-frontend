import { SUMMARY_TOGGLES } from '../../summaries/options.js'

export function LandSummary ({ summaries, onChange }) {
  const activeId = SUMMARY_TOGGLES.find(toggle => summaries[toggle.id])?.id

  return (
    <div className='app-map__land-summary'>
      <h3 className='govuk-heading-s govuk-!-margin-bottom-2'>Land summary</h3>
      <p className='govuk-body'>Inspect any point on the map to see its land cover, use, ownership, protected areas and soils.</p>
      <fieldset className='govuk-fieldset govuk-!-margin-top-2'>
        <legend className='govuk-body govuk-!-font-weight-bold govuk-!-margin-bottom-2'>Summarise land by:</legend>
        <div className='govuk-checkboxes govuk-checkboxes--small'>
          {SUMMARY_TOGGLES.map(toggle => (
            <div className='govuk-checkboxes__item' key={toggle.id}>
              <input
                className='govuk-checkboxes__input'
                id={`summary-${toggle.id}`}
                type='checkbox'
                value={toggle.id}
                checked={Boolean(summaries[toggle.id])}
                disabled={Boolean(activeId) && activeId !== toggle.id}
                onChange={event => onChange(toggle.id, event.currentTarget.checked)}
              />
              <label className='govuk-label govuk-checkboxes__label' htmlFor={`summary-${toggle.id}`}>
                {toggle.label}
              </label>
            </div>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
