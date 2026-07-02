const LINKS = [
  { text: 'Accessibility statement', href: '/accessibility-statement' },
  { text: 'Cookies', href: '/cookies' },
  { text: 'Privacy', href: '/privacy' }
]

function renderLink ({ text, href }) {
  return `
    <p class="govuk-body-s">
      <a class="govuk-link govuk-link--no-visited-state" href="${href}" target="_blank" rel="noopener noreferrer">
        ${text} (opens in new tab)
      </a>
    </p>`
}

const INFO_LINKS_HTML = `
    <div class="govuk-!-margin-top-4 govuk-!-margin-bottom-2">
      ${LINKS.map(renderLink).join('')}
    </div>`

export function renderInfoLinksPanelHtml () {
  return INFO_LINKS_HTML
}
