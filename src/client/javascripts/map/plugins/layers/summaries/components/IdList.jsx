import { useState } from 'react'

/** @param {{ items: Array<{ id: string, description?: string }>, label: string }} props */
export function IdList ({ items, label }) {
  const [open, setOpen] = useState(false)
  if (!items.length) {
    return null
  }

  return (
    <details className='govuk-details app-map__summary-id-list' onToggle={event => setOpen(event.currentTarget.open)}>
      <summary className='govuk-details__summary'>
        <span className='govuk-details__summary-text'>Show all {items.length} {label}</span>
      </summary>
      {open && (
        <section className='app-map__summary-id-scroll' tabIndex={0} aria-label={`${label} list`}>
          <ul className='govuk-list'>
            {items.map(({ id, description }) => (
              <li className='app-map__summary-id-row' key={id}>
                <span>{id}</span>
                {description && <span className='app-map__summary-id-description'>{description}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </details>
  )
}
