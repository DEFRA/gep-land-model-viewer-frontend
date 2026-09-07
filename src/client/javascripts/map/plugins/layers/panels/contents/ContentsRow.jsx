import { useSortable } from '@dnd-kit/react/sortable'
import { Eye, EyeOff, X } from 'lucide-preact'
import { useMemo } from 'react'
import { ActionsMenu } from './ActionsMenu.jsx'
import { LayerSwatch } from './LayerSwatch.jsx'

function moveMenuItems (index, length, handleSelect) {
  return [
    { id: 'top', label: 'Move to top', disabled: index === 0, handleSelect: () => handleSelect('top') },
    { id: 'up', label: 'Move up', disabled: index === 0, handleSelect: () => handleSelect('up') },
    { id: 'down', label: 'Move down', disabled: index === length - 1, handleSelect: () => handleSelect('down') },
    { id: 'bottom', label: 'Move to bottom', disabled: index === length - 1, handleSelect: () => handleSelect('bottom') }
  ]
}

export function ContentsRow ({
  entry,
  index,
  total,
  onVisibilityToggle,
  onRemove,
  onMove,
  portalContainerRef
}) {
  const sortableData = useMemo(() => ({ label: entry.label }), [entry.label])
  const { ref: rowRef, handleRef: reorderRef, isDragging } = useSortable({
    id: entry.id,
    index,
    data: sortableData,
    disabled: { draggable: entry.loading }
  })
  const menuItems = [
    ...moveMenuItems(index, total, position => onMove(entry, position)),
    ...(entry.kind === 'dataset' ? [{ id: 'edit', label: 'Edit layer', disabled: true }] : [])
  ]
  const VisibilityIcon = entry.hidden ? EyeOff : Eye
  const className = [
    'app-map__contents-row',
    entry.hidden && 'app-map__contents-row--hidden',
    isDragging && 'app-map__contents-row--dragging'
  ].filter(Boolean).join(' ')

  return (
    <li
      ref={rowRef}
      className={className}
      aria-busy={entry.loading ? 'true' : undefined}
    >
      <button
        ref={reorderRef}
        type='button'
        className='app-map__contents-reorder'
        aria-label={`Reorder ${entry.label}`}
        disabled={entry.loading}
      />
      <button
        type='button'
        className='im-c-map-button app-map__contents-icon-button'
        aria-label={`${entry.hidden ? 'Show' : 'Hide'} ${entry.label}`}
        disabled={entry.loading}
        onClick={() => onVisibilityToggle(entry)}
      >
        <VisibilityIcon />
      </button>
      <LayerSwatch swatch={entry.swatch} />
      <span className='app-map__contents-label'>{entry.label}</span>
      <ActionsMenu
        label={entry.label}
        items={menuItems}
        disabled={entry.loading}
        portalContainerRef={portalContainerRef}
      />
      <button
        type='button'
        className='im-c-map-button app-map__contents-icon-button'
        aria-label={`Remove ${entry.label}`}
        disabled={entry.loading}
        onClick={() => onRemove(entry)}
      >
        <X />
      </button>
    </li>
  )
}
