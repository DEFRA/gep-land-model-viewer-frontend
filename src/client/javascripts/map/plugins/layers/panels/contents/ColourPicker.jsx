import { useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import { RGBA_ALPHA_INDEX, colourForHex, hexForColour, normaliseHex } from '../../../../config/colours.js'
import { ErrorMessage } from '../../../../components/ErrorMessage.jsx'
import { colourForDefinition } from '../../datasets/layer-style.js'
import { hasVisibleFill, hasVisibleStroke } from '../../datasets/style-config.js'
import { StyleSwatch } from '../shared/StyleSwatch.jsx'

const COLOUR_PARTS = { fill: 'Fill', stroke: 'Outline' }

function ColourPickerControls ({ definition, part, partLabel, inputId, hexLabel, onCommit }) {
  const selectedColour = colourForDefinition(definition, part)
  const colour = hexForColour(selectedColour.slice(0, 3))
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState(false)
  const errorId = `${inputId}-error`
  const value = draft ?? colour
  const previewHex = normaliseHex(value)
  const previewColour = previewHex ? [...colourForHex(previewHex), selectedColour[RGBA_ALPHA_INDEX]] : selectedColour
  const preview = part === 'fill'
    ? { ...definition, fill: previewColour }
    : { ...definition, stroke: { ...definition.stroke, color: previewColour } }

  const updateDraft = (value) => {
    setDraft(value)
    setError(false)
  }

  const commit = (value) => {
    const hex = normaliseHex(value)
    if (!hex) {
      setError(true)
      return
    }

    setDraft(hex)
    setError(false)
    onCommit(hex, part)
  }

  return (
    <>
      <HexColorPicker
        color={previewHex ?? colour}
        onChange={updateDraft}
        onChangeEnd={commit}
        role='group'
        aria-label={`${partLabel} colour for ${definition.label}`}
      />
      <div className={`govuk-form-group govuk-!-margin-bottom-0${error ? ' govuk-form-group--error' : ''}`}>
        <label className='govuk-label govuk-label--s' htmlFor={inputId}>{hexLabel}</label>
        <div className='govuk-hint' id={`${inputId}-hint`}>For example, #00703c</div>
        {error && (
          <ErrorMessage id={errorId}>Enter 3 or 6 hexadecimal characters.</ErrorMessage>
        )}
        <div className='app-map__colour-value'>
          <input
            id={inputId}
            className={`govuk-input govuk-input--width-10${error ? ' govuk-input--error' : ''}`}
            type='text'
            spellcheck={false}
            value={value}
            aria-invalid={error || undefined}
            aria-describedby={`${inputId}-hint${error ? ` ${errorId}` : ''}`}
            onInput={event => updateDraft(event.currentTarget.value)}
            onBlur={event => commit(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commit(event.currentTarget.value)
              }
            }}
          />
          <StyleSwatch definition={preview} />
        </div>
      </div>
    </>
  )
}

export function ColourPicker ({ definition, inputId, onCommit }) {
  const [part, setPart] = useState(hasVisibleFill(definition) ? 'fill' : 'stroke')
  const canChoosePart = hasVisibleFill(definition) && hasVisibleStroke(definition)
  const partLabel = COLOUR_PARTS[part]
  const hexLabel = canChoosePart || part === 'stroke' ? `${partLabel} hex colour` : 'Hex colour'

  return (
    <div className='app-map__colour-picker'>
      {canChoosePart && (
        <fieldset className='govuk-fieldset govuk-!-margin-bottom-3'>
          <legend className='govuk-fieldset__legend govuk-visually-hidden'>Colour to edit</legend>
          <div className='govuk-radios govuk-radios--small govuk-radios--inline'>
            {Object.entries(COLOUR_PARTS).map(([value, label]) => (
              <div className='govuk-radios__item' key={value}>
                <input
                  className='govuk-radios__input'
                  id={`${inputId}-${value}`}
                  name={`${inputId}-part`}
                  type='radio'
                  value={value}
                  checked={part === value}
                  onChange={() => setPart(value)}
                />
                <label className='govuk-label govuk-radios__label' htmlFor={`${inputId}-${value}`}>{label}</label>
              </div>
            ))}
          </div>
        </fieldset>
      )}
      <ColourPickerControls
        key={part}
        definition={definition}
        part={part}
        partLabel={partLabel}
        inputId={inputId}
        hexLabel={hexLabel}
        onCommit={onCommit}
      />
    </div>
  )
}
