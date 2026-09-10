import { lazy, Suspense } from 'react'

const ContentsPanelContent = lazy(() => import('./ContentsPanelContent.jsx')
  .then(module => ({ default: module.ContentsPanelContent })))

export function ContentsPanel (props) {
  return (
    <Suspense fallback={(
      <div className='app-map__contents-panel'>
        <p className='app-map__contents-message govuk-body govuk-!-margin-bottom-0'>Loading contents…</p>
      </div>
    )}
    >
      <ContentsPanelContent {...props} />
    </Suspense>
  )
}
