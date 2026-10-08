import { useState } from 'react'
import { Copy } from 'lucide-preact'
import { SummaryList } from '../../panels/shared/SummaryList.jsx'
import { formatGridSize } from './format.js'
import { parseBngRef } from '../grid/bng-reference.js'

function CopyIdentifier ({ label, value }) {
  const [message, setMessage] = useState('')
  const copy = () => {
    setMessage('')
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(value))
      .then(() => setMessage(`${label} copied`))
      .catch(() => setMessage(`Could not copy ${label}. Select the identifier to copy it.`))
  }

  return (
    <>
      <button className='app-map__summary-copy' type='button' onClick={copy} title={`Copy ${label} to clipboard`} aria-label={`Copy ${label} ${value}`}>
        <span>{value}</span><Copy aria-hidden='true' />
      </button>
      <output className='govuk-visually-hidden'>{message}</output>
    </>
  )
}

/** @param {import('../model.js').GridUnit | import('../model.js').FeatureUnit} unit */
function identifierRows (unit) {
  if (unit.kind === 'grid') {
    return [{ label: 'Grid square', value: <CopyIdentifier key={unit.bngRef} label='grid reference' value={parseBngRef(unit.bngRef)?.formatted ?? unit.bngRef} /> }]
  }

  return [
    { label: 'OSID', value: <CopyIdentifier key={unit.osid} label='OSID' value={unit.osid} /> },
    ...(unit.toid ? [{ label: 'TOID', value: unit.toid }] : [])
  ]
}

/** @param {{ unit: import('../model.js').GridUnit | import('../model.js').FeatureUnit }} props */
export function SummaryHeader ({ unit }) {
  return (
    <header className='app-map__summary-header'>
      <SummaryList className='app-map__summary-ids' noBorder rows={identifierRows(unit)} />
      {unit.kind === 'grid' && <p className='app-map__summary-size'>{formatGridSize(unit.cellSize)}</p>}
    </header>
  )
}
