import { useId, useState } from 'react'
import { LinkButton } from '../../../../components/LinkButton.jsx'

const PREVIEW_LENGTH = 300

export function DatasetAbstract ({ text }) {
  const [expanded, setExpanded] = useState(false)
  const contentId = useId()
  const trimmedText = text.trim()
  if (!trimmedText) {
    return null
  }

  const paragraphs = trimmedText.split(/\r?\n+/).map(paragraph => paragraph.trim()).filter(Boolean)
  const content = paragraphs.map((paragraph, index) => (
    <p
      className={`govuk-body ${index === paragraphs.length - 1 ? 'govuk-!-margin-bottom-0' : 'govuk-!-margin-bottom-4'}`}
      key={paragraph}
    >
      {paragraph}
    </p>
  ))

  if (trimmedText.length <= PREVIEW_LENGTH) {
    return <div className='govuk-!-margin-bottom-5'>{content}</div>
  }

  const preview = trimmedText.slice(0, PREVIEW_LENGTH).replace(/\s\S*$/, '').trimEnd()

  return (
    <div className='govuk-!-margin-bottom-5'>
      <div id={contentId} className='govuk-!-margin-bottom-2'>
        {expanded ? content : <p className='govuk-body govuk-!-margin-bottom-0'>{preview}...</p>}
      </div>
      <LinkButton
        className='govuk-!-font-size-19'
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Show less' : 'Show more'}
      </LinkButton>
    </div>
  )
}
