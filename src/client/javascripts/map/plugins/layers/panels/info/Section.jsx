import { useContext } from 'react'
import { InfoPanelContext } from './context.js'

export function Section ({ title, preview = null, open = false, children }) {
  const { sections } = useContext(InfoPanelContext)

  return (
    <details
      className='app-map__info-section'
      open={sections.get(title) ?? open}
      onToggle={event => sections.set(title, event.currentTarget.open)}
    >
      <summary className='app-map__info-section-heading'>
        <span className='app-map__info-section-title'>{title}</span>
        {preview ? <span className='app-map__info-section-value'>{preview}</span> : null}
      </summary>
      <div className='app-map__info-section-detail'>{children}</div>
    </details>
  )
}
