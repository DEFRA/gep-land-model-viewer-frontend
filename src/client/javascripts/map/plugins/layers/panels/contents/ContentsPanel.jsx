import { lazy, Suspense } from 'react'

// Defer loading the drag-and-drop library until the Contents panel is opened.
const ContentsPanelContent = lazy(() => import('./ContentsPanelContent.jsx')
  .then(module => ({ default: module.ContentsPanelContent })))

export function ContentsPanel (props) {
  return (
    <Suspense fallback={(
      <div className='app-map__contents-panel'>
        <p className='govuk-body govuk-!-margin-bottom-0'>Loading contents…</p>
      </div>
    )}
    >
      <ContentsPanelContent {...props} />
    </Suspense>
  )
}
