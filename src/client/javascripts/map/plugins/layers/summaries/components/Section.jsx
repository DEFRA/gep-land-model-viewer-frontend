import { useContext } from 'react'
import { InfoPanelContext } from '../../panels/info/context.js'
import { SUMMARY_DEFINITIONS } from '../definitions.js'

export function Section ({ sectionKey, title, preview, children }) {
  const { sections } = useContext(InfoPanelContext)
  const definition = SUMMARY_DEFINITIONS[sectionKey]

  return (
    <details
      className='app-map__summary-section'
      open={sections.get(sectionKey) ?? true}
      onToggle={event => sections.set(sectionKey, event.currentTarget.open)}
    >
      <summary className='app-map__summary-section-heading'>
        <span className='app-map__summary-section-title'>{title}</span>
        <span className='app-map__summary-section-value'>{preview}</span>
      </summary>
      <div className='app-map__summary-detail'>
        {children}
        <p className='app-map__summary-definition'>
          <a className='govuk-link' href={definition.href} target='_blank' rel='noopener noreferrer'>{definition.label}<span className='govuk-visually-hidden'> (opens in a new tab)</span></a>
        </p>
      </div>
    </details>
  )
}
