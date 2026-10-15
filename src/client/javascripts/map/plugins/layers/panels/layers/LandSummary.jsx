import { useRef } from 'react'
import { Popover } from '@base-ui/react/popover'
import { Info } from 'lucide-preact'
import { InfoPopoverPopup } from '../shared/InfoPopover.jsx'
import { SUMMARIES } from '../../summaries/config.js'
import { CheckboxError } from './CheckboxError.jsx'

const FAILED_MESSAGE = 'This land summary could not be added. Try again later.'

function SummaryRow ({ summary, layer, failed, activeId, onChange }) {
  const hidden = Boolean(layer?.hidden)
  const errorId = failed ? `summary-${summary.id}-error` : undefined

  return (
    <div className='app-map__layer-row'>
      <div className='govuk-checkboxes__item'>
        <input
          className='govuk-checkboxes__input'
          id={`summary-${summary.id}`}
          type='checkbox'
          value={summary.id}
          checked={Boolean(layer)}
          disabled={Boolean(activeId) && activeId !== summary.id}
          aria-describedby={errorId}
          aria-label={hidden ? `${summary.label}, hidden` : undefined}
          onChange={event => onChange(summary.id, event.currentTarget.checked)}
        />
        <label className='govuk-label govuk-checkboxes__label' htmlFor={`summary-${summary.id}`}>
          <span className={hidden ? 'app-map__layers-label--hidden' : undefined}>{summary.label}</span>
        </label>
        {errorId && <CheckboxError id={errorId}>{FAILED_MESSAGE}</CheckboxError>}
      </div>
      <Popover.Trigger
        className='im-c-map-button app-map__layer-info-button'
        aria-label={`About ${summary.label}`}
        payload={summary.id}
      >
        <Info size={24} aria-hidden='true' />
      </Popover.Trigger>
    </div>
  )
}

export function LandSummary ({ layers, failedLayerIds, onChange }) {
  const summaryRef = useRef(null)
  const summaries = SUMMARIES.map(summary => ({
    summary,
    layer: layers.find(layer => layer.id === summary.id)
  }))
  const activeId = summaries.find(({ layer }) => layer)?.summary.id

  return (
    <div className='app-map__land-summary' ref={summaryRef}>
      <h3 className='govuk-heading-s govuk-!-margin-bottom-2'>Land summary</h3>
      <p className='govuk-body-s app-map__layers-description govuk-!-margin-bottom-3'>Inspect any point on the map to see its land cover, use, ownership, protected areas and soils.</p>
      <Popover.Root>
        {({ payload }) => {
          const infoSummary = SUMMARIES.find(summary => summary.id === payload)

          return (
            <>
              <fieldset className='govuk-fieldset govuk-!-margin-top-2'>
                <legend className='govuk-body govuk-!-font-weight-bold govuk-!-margin-bottom-2'>Summarise land by:</legend>
                <div className='govuk-checkboxes govuk-checkboxes--small'>
                  {summaries.map(({ summary, layer }) => (
                    <SummaryRow
                      key={summary.id}
                      summary={summary}
                      layer={layer}
                      failed={failedLayerIds.includes(summary.id)}
                      activeId={activeId}
                      onChange={onChange}
                    />
                  ))}
                </div>
              </fieldset>
              <InfoPopoverPopup label={`About ${infoSummary?.label}`} side='right' container={summaryRef}>
                {infoSummary?.description}
              </InfoPopoverPopup>
            </>
          )
        }}
      </Popover.Root>
    </div>
  )
}
