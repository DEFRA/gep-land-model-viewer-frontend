import { useId, useRef, useState } from 'react'
import { Popover } from '@base-ui/react/popover'
import { ChevronLeft, X } from 'lucide-preact'
import { RGBA_ALPHA_INDEX, colourForHex } from '../../../../config/colours.js'
import { LinkButton } from '../../../../components/LinkButton.jsx'
import { colourForDefinition, getLayerStyle, coloursEqual } from '../../datasets/layer-style.js'
import { editableStyleEntries } from '../../datasets/style-config.js'
import { StyleSwatch } from '../shared/StyleSwatch.jsx'
import { ColourPicker } from './ColourPicker.jsx'
import { OpacityInput } from './OpacityInput.jsx'

export function EditLayerForm ({ dataset, layer, mobile, colourKey, onBack, dispatch }) {
  const [opacityKey, setOpacityKey] = useState(0)
  const editorRef = useRef(null)
  const id = useId()
  const { opacity, styleConfig } = getLayerStyle(dataset, layer)
  const defaults = getLayerStyle(dataset)
  const entries = editableStyleEntries(styleConfig)
  const selectedColour = entries.find(entry => entry.key === colourKey)
  const drawerColourOpen = mobile && Boolean(selectedColour)
  const ColourButton = mobile ? 'button' : Popover.Trigger

  const commitColour = ({ classIndex }, hex, part) => {
    const definition = classIndex === undefined ? defaults.styleConfig.default : defaults.styleConfig.classes[classIndex]
    const defaultColour = colourForDefinition(definition, part)
    const colour = [...colourForHex(hex), defaultColour[RGBA_ALPHA_INDEX]]
    dispatch({
      type: 'SET_LAYER_COLOUR',
      payload: {
        id: dataset.id,
        classIndex,
        part,
        colour: coloursEqual(colour, defaultColour) ? undefined : colour
      }
    })
  }

  const reset = () => {
    dispatch({ type: 'RESET_LAYER_STYLE', payload: { id: dataset.id } })
    setOpacityKey(key => key + 1) // Reset the OpacityInput
  }

  return (
    <Popover.Root>
      {({ payload }) => (
        <div className='app-map__edit-layer-view' ref={editorRef}>
          <LinkButton
            className='app-map__editor-back'
            onClick={drawerColourOpen ? () => dispatch({ type: 'SET_EDITING_LAYER', payload: { id: dataset.id } }) : onBack}
          >
            <ChevronLeft aria-hidden='true' />
            {drawerColourOpen ? 'Back to Edit layer' : 'Back to Contents'}
          </LinkButton>
          {/* Keep the form mounted so Back preserves the palette's scroll position. */}
          <div hidden={drawerColourOpen}>
            {entries.length > 0 && (
              <ul className='app-map__edit-colours'>
                {entries.map(({ key, definition }) => (
                  <li className='app-map__edit-colour-row' key={key}>
                    <ColourButton
                      type='button'
                      payload={mobile ? undefined : key}
                      onClick={mobile ? () => dispatch({ type: 'SET_EDITING_LAYER', payload: { id: dataset.id, colourKey: key } }) : undefined}
                      className='app-map__edit-colour-button'
                      aria-label={`Edit colour for ${definition.label}`}
                    >
                      <StyleSwatch definition={definition} />
                    </ColourButton>
                    <span className='govuk-body-s govuk-!-margin-bottom-0'>{definition.label}</span>
                  </li>
                ))}
              </ul>
            )}
            <OpacityInput
              key={opacityKey}
              inputId={`${id}-opacity`}
              opacity={opacity}
              onCommit={value => dispatch({
                type: 'SET_LAYER_OPACITY',
                payload: { id: dataset.id, opacity: value === defaults.opacity ? undefined : value }
              })}
            />
            <Popover.Close render={<LinkButton />} className='app-map__reset-style' onClick={reset}>
              Reset to defaults
            </Popover.Close>
          </div>
          {!mobile && (
            <ColourPopover
              entry={entries.find(entry => entry.key === payload)}
              editorRef={editorRef}
              inputId={`${id}-hex`}
              onCommit={commitColour}
            />
          )}
          {drawerColourOpen && (
            <ColourPicker
              key={selectedColour.key}
              inputId={`${id}-hex`}
              definition={selectedColour.definition}
              onCommit={(hex, part) => commitColour(selectedColour, hex, part)}
            />
          )}
        </div>
      )}
    </Popover.Root>
  )
}

function ColourPopover ({ entry, editorRef, inputId, onCommit }) {
  return (
    <Popover.Portal container={editorRef}>
      <Popover.Positioner
        className='app-map__colour-positioner'
        anchor={editorRef}
        side='left'
        align='start'
        sideOffset={8}
        positionMethod='fixed'
        collisionPadding={8}
        collisionAvoidance={{ side: 'shift', align: 'none' }}
      >
        <Popover.Popup className='app-map__colour-popup'>
          {entry && (
            <>
              <div className='app-map__editor-heading'>
                <Popover.Title id={`${inputId}-title`} className='im-e-heading-s'>
                  <span className='govuk-visually-hidden'>Colour for</span>{' '}{entry.definition.label}
                </Popover.Title>
                <Popover.Close className='im-c-map-button app-map__contents-icon-button' aria-label='Close colour picker'>
                  <X />
                </Popover.Close>
              </div>
              <ColourPicker
                key={entry.key}
                inputId={inputId}
                definition={entry.definition}
                onCommit={(hex, part) => onCommit(entry, hex, part)}
              />
            </>
          )}
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  )
}
