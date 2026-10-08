import { Popover } from '@base-ui/react/popover'
import { Info } from 'lucide-preact'

/**
 * Rendered into `container` to keep it inside the panel, which is a modal drawer on mobile.
 * @param {{ label: string, children: import('preact').ComponentChildren, container: import('preact').RefObject<HTMLElement>, side?: 'left' | 'right' }} props
 */
export function InfoPopoverPopup ({ label, children, container, side = 'left' }) {
  return (
    <Popover.Portal container={container}>
      <Popover.Positioner className='app-map__info-popover-positioner' side={side} sideOffset={8} positionMethod='fixed' collisionPadding={8}>
        <Popover.Popup className='app-map__info-popover-popup' aria-label={label}>
          <Popover.Description className='im-c-hints__hint'>{children}</Popover.Description>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  )
}

/**
 * @param {{ label: string, children: import('preact').ComponentChildren, container: import('preact').RefObject<HTMLElement> }} props
 */
export function InfoPopover ({ label, children, container }) {
  return (
    <span className='app-map__info-popover'>
      <Popover.Root>
        <Popover.Trigger className='app-map__info-popover-trigger' aria-label={label}>
          <Info size={14} aria-hidden='true' />
        </Popover.Trigger>
        <InfoPopoverPopup label={label} container={container}>{children}</InfoPopoverPopup>
      </Popover.Root>
    </span>
  )
}
