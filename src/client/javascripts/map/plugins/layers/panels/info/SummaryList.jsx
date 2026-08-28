/**
 * @param {{ rows: Array<{ label: string, value: import('preact').ComponentChildren }>, className?: string, noBorder?: boolean }} props
 */
export function SummaryList ({ rows, className, noBorder = true }) {
  const classes = [
    'govuk-summary-list',
    noBorder && 'govuk-summary-list--no-border',
    className
  ].filter(Boolean).join(' ')

  return (
    <dl className={classes}>
      {rows.map(({ label, value }) => (
        <div className='govuk-summary-list__row' key={label}>
          <dt className='govuk-summary-list__key'>{label}</dt>
          <dd className='govuk-summary-list__value'>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
