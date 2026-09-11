import { useState } from 'react'
import { Slider } from '@base-ui/react/slider'
import { ErrorMessage } from '../../../../components/ErrorMessage.jsx'

function parsePercentage (value) {
  const percentage = Number(value)
  return /^\d{1,3}$/.test(value.trim()) && percentage >= 1 && percentage <= 100 ? percentage : null
}

export function OpacityInput ({ opacity, inputId, onCommit }) {
  const percentage = Math.round(opacity * 100)
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState(false)
  const errorId = `${inputId}-error`
  const value = draft ?? String(percentage)

  const apply = (nextPercentage) => {
    setDraft(null)
    setError(false)
    onCommit(nextPercentage / 100)
  }

  const commit = (nextValue) => {
    const next = parsePercentage(nextValue)
    if (next === null) {
      setError(true)
      return
    }

    apply(next)
  }

  return (
    <Slider.Root
      id={`${inputId}-slider`}
      className={`app-map__opacity govuk-form-group govuk-!-margin-bottom-0${error ? ' govuk-form-group--error' : ''}`}
      min={1}
      max={100}
      step={1}
      value={percentage}
      onValueChange={apply}
    >
      <div className='app-map__opacity-heading'>
        <Slider.Label className='govuk-label govuk-label--s govuk-!-margin-bottom-0'>Opacity</Slider.Label>
        <div className='govuk-input__wrapper'>
          <label className='govuk-visually-hidden' htmlFor={inputId}>Opacity percentage</label>
          <input
            id={inputId}
            className={`govuk-input govuk-input--width-3${error ? ' govuk-input--error' : ''}`}
            type='text'
            inputMode='numeric'
            value={value}
            aria-invalid={error || undefined}
            aria-describedby={error ? errorId : undefined}
            onInput={(event) => {
              setDraft(event.currentTarget.value)
              setError(false)
            }}
            onBlur={event => commit(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commit(event.currentTarget.value)
              }
            }}
          />
          <div className='govuk-input__suffix' aria-hidden='true'>%</div>
        </div>
      </div>
      {error && (
        <ErrorMessage id={errorId}>Enter a whole number from 1 to 100.</ErrorMessage>
      )}
      <Slider.Control className='app-map__opacity-range'>
        <Slider.Track className='app-map__opacity-track'>
          <Slider.Indicator className='app-map__opacity-indicator' />
        </Slider.Track>
        <Slider.Thumb className='app-map__opacity-thumb' aria-valuetext={`${percentage}%`} />
      </Slider.Control>
    </Slider.Root>
  )
}
