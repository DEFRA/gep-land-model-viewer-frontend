import { Menu } from '@base-ui/react/menu'
import { EllipsisVertical } from 'lucide-preact'

const menuItemClassName = ({ highlighted }) => [
  'im-c-popup-menu__item',
  highlighted && 'im-c-popup-menu__item--selected'
].filter(Boolean).join(' ')

export function ActionsMenu ({ label, items, portalContainerRef, disabled = false }) {
  return (
    <Menu.Root modal={false} disabled={disabled} highlightItemOnHover={false}>
      <Menu.Trigger
        className='im-c-map-button app-map__contents-icon-button'
        aria-label={`Layer actions for ${label}`}
      >
        <EllipsisVertical />
      </Menu.Trigger>
      <Menu.Portal container={portalContainerRef}>
        <Menu.Positioner
          className='app-map__contents-menu-positioner'
          side='bottom'
          align='end'
          sideOffset={4}
          positionMethod='fixed'
        >
          <Menu.Popup className='im-c-popup-menu app-map__contents-menu'>
            {items.map(item => (
              <Menu.Item
                className={menuItemClassName}
                disabled={item.disabled}
                onClick={item.handleSelect}
                key={item.id}
              >
                <span className='im-c-popup-menu__item-label'>{item.label}</span>
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
