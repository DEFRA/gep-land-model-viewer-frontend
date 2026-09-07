import { DragDropProvider } from '@dnd-kit/react'
import { Accessibility, StyleInjector, defaultPreset } from '@dnd-kit/dom'
import { move } from '@dnd-kit/helpers'
import { useMemo, useRef } from 'react'
import { layerIndexAfterMove } from '../../reducer.js'
import { ContentsRow } from './ContentsRow.jsx'
import { getContentsEntries } from './contents-entries.js'

const dragAnnouncements = {
  dragstart: ({ operation: { source } }) => source
    ? `${source.data.label} picked up.`
    : undefined,
  dragover: ({ operation: { source, target } }) => source && target && source.id !== target.id
    ? `${source.data.label} moved to position ${target.sortable.index + 1}.`
    : undefined,
  dragend: ({ operation: { source }, canceled }) => {
    if (!source) {
      return undefined
    }

    return canceled
      ? `Reordering ${source.data.label} cancelled.`
      : `${source.data.label} placed at position ${source.sortable.index + 1}.`
  }
}

const configureDragDropPlugins = styleNonce => [
  StyleInjector.configure({ nonce: styleNonce }),
  ...defaultPreset.plugins.map(plugin => plugin === Accessibility
    ? Accessibility.configure({ announcements: dragAnnouncements })
    : plugin)
]

export function ContentsPanelContent ({ pluginConfig, pluginState, services }) {
  const { datasets, styleNonce } = pluginConfig
  const { dispatch, layers } = pluginState
  const { announce } = services
  const panelRef = useRef(null)
  const entries = getContentsEntries(datasets, pluginState)
  const layerIds = layers.map(layer => layer.id)
  const dndPlugins = useMemo(() => configureDragDropPlugins(styleNonce), [styleNonce])

  const handleVisibilityToggle = (entry) => {
    const hidden = !entry.hidden
    dispatch({ type: 'SET_LAYER_HIDDEN', payload: { id: entry.id, hidden } })
    announce(`${entry.label} ${hidden ? 'hidden' : 'shown'}`)
  }

  const handleRemove = (entry) => {
    dispatch({ type: 'REMOVE_LAYER', payload: { id: entry.id } })
    announce(`${entry.label} removed`)
  }

  const handleMove = (entry, position) => {
    const index = layerIds.indexOf(entry.id)
    const targetIndex = layerIndexAfterMove(index, layerIds.length, position)
    dispatch({ type: 'MOVE_LAYER', payload: { id: entry.id, position } })
    announce(`${entry.label} moved to position ${targetIndex + 1} of ${layerIds.length}`)
  }

  const handleDragEnd = (event) => {
    const order = move(layerIds, event)

    if (order !== layerIds) {
      dispatch({ type: 'SET_LAYER_ORDER', payload: { order } })
    }
  }

  return (
    <div className='app-map__contents-panel' ref={panelRef}>
      {entries.length
        ? (
          <DragDropProvider plugins={dndPlugins} onDragEnd={handleDragEnd}>
            <ul className='app-map__contents-list'>
              {entries.map((entry, index) => (
                <ContentsRow
                  key={entry.id}
                  entry={entry}
                  index={index}
                  total={entries.length}
                  onVisibilityToggle={handleVisibilityToggle}
                  onRemove={handleRemove}
                  onMove={handleMove}
                  portalContainerRef={panelRef}
                />
              ))}
            </ul>
          </DragDropProvider>
          )
        : (
          <p className='govuk-body govuk-!-margin-bottom-0'>
            No layers added
          </p>
          )}
    </div>
  )
}
