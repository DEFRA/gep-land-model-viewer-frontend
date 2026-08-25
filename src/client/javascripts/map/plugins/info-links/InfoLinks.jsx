const LINKS = [
  { text: 'Accessibility statement', href: '/accessibility-statement' },
  { text: 'Cookies', href: '/cookies' },
  { text: 'Privacy', href: '/privacy' }
]

export function InfoLinks () {
  return (
    <div className='govuk-!-margin-top-4 govuk-!-margin-bottom-2'>
      {LINKS.map(({ text, href }) => (
        <p className='govuk-body-s' key={href}>
          <a className='govuk-link govuk-link--no-visited-state' href={href} target='_blank' rel='noopener noreferrer'>
            {text} (opens in new tab)
          </a>
        </p>
      ))}
    </div>
  )
}
