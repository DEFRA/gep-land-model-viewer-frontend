import { forwardRef } from 'react'

export const LinkButton = forwardRef(function LinkButton (
  /** @type {import('react').ComponentProps<'button'>} */ { className = '', children, ...props }, ref
) {
  return (
    <button
      ref={ref}
      type='button'
      className={['app-link-button', className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </button>
  )
})
