import { SummaryList } from '../panels/info/SummaryList.jsx'

function attributeText (value) {
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

export function DatasetAttributes ({ label, features }) {
  return (
    <div className='app-map__info-content'>
      <h3 className='govuk-heading-s'>{label}</h3>
      {features.length
        ? features.map((properties, index) => (
          <SummaryList
            className='app-map__info-attributes'
            noBorder={false}
            rows={Object.entries(properties)
              .filter(([, value]) => value != null && value !== '')
              .map(([name, value]) => ({ label: name, value: attributeText(value) }))}
            key={index}
          />
        ))
        : <p className='govuk-body'>No attributes found at this location.</p>}
    </div>
  )
}
