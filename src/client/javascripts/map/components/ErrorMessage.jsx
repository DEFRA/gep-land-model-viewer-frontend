export function ErrorMessage ({ id, children }) {
  return (
    <p className='govuk-error-message govuk-!-margin-bottom-3' id={id} role='alert'>
      <span className='govuk-visually-hidden'>Error:</span> {children}
    </p>
  )
}
