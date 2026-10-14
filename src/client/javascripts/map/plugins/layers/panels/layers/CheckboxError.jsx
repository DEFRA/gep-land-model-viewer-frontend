export function CheckboxError ({ id, children }) {
  return (
    <p id={id} className='govuk-error-message govuk-checkboxes__hint govuk-!-font-size-16'>
      <span className='govuk-visually-hidden'>Error:</span> {children}
    </p>
  )
}
