import { useContext } from 'react'
import { InfoPanelContext } from '../../panels/info/context.js'
import { LinkButton } from '../../../../components/LinkButton.jsx'

/** @param {{ count: number, label: string }} props */
export function SelectionHeader ({ count, label }) {
  const { clearSelection } = useContext(InfoPanelContext)

  return (
    <header className='app-map__summary-header'>
      <h3 className='govuk-heading-s app-map__summary-selection-count'>{count} {label} selected</h3>
      <LinkButton onClick={clearSelection}>Clear selection</LinkButton>
      <p className='govuk-hint app-map__summary-selection-note'>Combined summary of the selected {label}.</p>
    </header>
  )
}
