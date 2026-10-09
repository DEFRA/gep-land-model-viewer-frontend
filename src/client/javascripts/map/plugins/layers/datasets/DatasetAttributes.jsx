import { useContext } from 'react'
import { SummaryList } from '../panels/shared/SummaryList.jsx'
import { FullDatasetLink } from '../panels/shared/FullDatasetLink.jsx'
import { InfoPanelContext } from '../panels/info/context.js'

function attributeText (value) {
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

function attributeRows (properties) {
  return Object.entries(properties)
    .filter(([, value]) => value != null && value !== '')
    .map(([name, value]) => ({ label: name, value: attributeText(value) }))
}

export function DatasetAttributes ({ label, features, datasetId }) {
  const findGeoDataUrl = useContext(InfoPanelContext)?.findGeoDataUrl
  const rowsByFeature = features.map(attributeRows).filter((rows) => rows.length)

  return (
    <div className='app-map__info-content'>
      <h3 className='govuk-heading-s'>{label}</h3>
      {rowsByFeature.length
        ? rowsByFeature.map((rows, index) => (
          <SummaryList
            className='app-map__summary-list app-map__info-attributes'
            rows={rows}
            key={index}
          />
        ))
        : <p className='govuk-body'>No attributes found at this location.</p>}
      <FullDatasetLink datasetId={datasetId} findGeoDataUrl={findGeoDataUrl} />
    </div>
  )
}
