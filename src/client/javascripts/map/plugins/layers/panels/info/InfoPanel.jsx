import { InfoPanelContext } from './context.js'
import { InlineIcon } from '../../../../components/InlineIcon.jsx'
import { LinkButton } from '../../../../components/LinkButton.jsx'
import { CHEVRON_LEFT_ICON, CHEVRON_RIGHT_ICON } from '../../icons.js'
import { INSPECTION_STATUS } from '../../reducer.js'

const SAMPLE_CENTER = [465000, 475000]
const SAMPLE_ZOOM = 11

function Message ({ children }) {
  return <p className='govuk-body govuk-hint app-map__info-panel-message'>{children}</p>
}

function HitList ({ hits, onSelectHit }) {
  return (
    <div className='app-map__info-content'>
      <p className='govuk-body app-map__info-hit-hint'>More than one feature is at this location. Select one to view its attributes.</p>
      <ul className='app-map__info-hit-list'>
        {hits.map(hit => (
          <li className='app-map__info-hit-row' key={hit.id}>
            <button type='button' className='app-map__info-hit' onClick={() => onSelectHit(hit)}>
              <span>{hit.label}</span>
              <InlineIcon className='app-map__info-chevron' content={CHEVRON_RIGHT_ICON} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function HitDetail ({ hit, status, backCount, onBack, renderHit }) {
  return (
    <>
      {backCount > 0 && (
        <LinkButton className='app-map__info-back' onClick={onBack}>
          <InlineIcon className='app-map__info-chevron' content={CHEVRON_LEFT_ICON} />
          Back to {backCount} selected
        </LinkButton>
      )}
      {status === INSPECTION_STATUS.DETAIL_LOADING && <Message>Loading details...</Message>}
      {status === INSPECTION_STATUS.DETAIL_ERROR && <Message>Could not load details. Try selecting again.</Message>}
      {status === INSPECTION_STATUS.DETAIL_READY && renderHit(hit)}
    </>
  )
}

function PanelBody ({ status, hits, hit, onSelectHit, onBack, renderHit }) {
  if (status === INSPECTION_STATUS.EMPTY) {
    return <Message>No information found at this location.</Message>
  }

  if (hit) {
    return <HitDetail hit={hit} status={status} backCount={hits.length > 1 ? hits.length : 0} onBack={onBack} renderHit={renderHit} />
  }

  if (status === INSPECTION_STATUS.LIST) {
    return <HitList hits={hits} onSelectHit={onSelectHit} />
  }

  if (status === INSPECTION_STATUS.SEARCHING) {
    return <Message>Loading details...</Message>
  }

  return null
}

export function InfoPanel ({ pluginState, mapProvider }) {
  const sectionsRef = pluginState.useRef('inspectionSections')
  sectionsRef.current ??= new Map()
  const sections = sectionsRef.current
  const inspectionRef = pluginState.useRef('inspection')
  /** @type {import('../../reducer.js').InspectionState} */
  const inspection = pluginState.inspection
  const map = mapProvider.map
  const isLoading = inspection.status === INSPECTION_STATUS.SEARCHING || inspection.status === INSPECTION_STATUS.DETAIL_LOADING
  const goToSampleArea = () => {
    const view = map.getView()
    view.setCenter(SAMPLE_CENTER)
    view.setZoom(SAMPLE_ZOOM)
  }

  return (
    <InfoPanelContext.Provider value={{ sections, goToSampleArea }}>
      <div className='app-map__info-panel' aria-busy={isLoading ? 'true' : undefined}>
        <PanelBody
          status={inspection.status}
          hits={inspection.hits}
          hit={inspection.hit}
          onSelectHit={hit => inspectionRef.current?.selectHit(hit)}
          onBack={() => inspectionRef.current?.showHitList()}
          renderHit={hit => inspectionRef.current?.renderHit(hit)}
        />
      </div>
    </InfoPanelContext.Provider>
  )
}
