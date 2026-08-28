export function LinkButton ({ className = '', children, ...props }) {
  return (
    <button
      type='button'
      className={['app-link-button', className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
