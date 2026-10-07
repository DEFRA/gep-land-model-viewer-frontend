/**
 * @param {{ rows: Array<{ label: string, labelSuffix?: import('preact').ComponentChildren, value: import('preact').ComponentChildren }>, className?: string, noBorder?: boolean }} props
 */
export function SummaryList ({ rows, className, noBorder = false }) {
  const classes = [
    'govuk-summary-list',
    noBorder && 'govuk-summary-list--no-border',
    className
  ].filter(Boolean).join(' ')

  return (
    <dl className={classes}>
      {rows.map(({ label, labelSuffix, value }) => (
        <div className='govuk-summary-list__row' key={label}>
          <dt className='govuk-summary-list__key'>{label}{labelSuffix}</dt>
          <dd className='govuk-summary-list__value'>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
