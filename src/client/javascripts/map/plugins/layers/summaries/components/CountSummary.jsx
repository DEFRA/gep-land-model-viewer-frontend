import { SummaryList } from '../../panels/shared/SummaryList.jsx'

/** @param {{ label: string, labelSuffix?: import('preact').ComponentChildren, count: number, emptyMessage?: string }} props */
export function CountSummary ({ label, labelSuffix, count, emptyMessage = 'None' }) {
  return (
    <>
      <SummaryList className='app-map__summary-list' noBorder={count === 0} rows={[{ label, labelSuffix, value: count }]} />
      {count === 0 && <p className='app-map__summary-message app-map__summary-empty-message'>{emptyMessage}</p>}
    </>
  )
}
