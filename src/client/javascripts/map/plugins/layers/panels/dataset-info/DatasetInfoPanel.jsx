import { format, parseISO } from 'date-fns'
import { DatasetAbstract } from './DatasetAbstract.jsx'

export function DatasetInfoPanel ({ datasetId, pluginConfig }) {
  const dataset = pluginConfig.datasets.find(candidate => candidate.id === datasetId)
  const metadata = dataset?.metadata ?? {}
  const rows = [
    ['Source', metadata.owner],
    ['Category', metadata.categories?.join(', ')],
    ['Creation date', metadata.creationDate && format(parseISO(metadata.creationDate), 'dd MMMM yyyy')],
    ['Last updated', metadata.updatedAt && format(parseISO(metadata.updatedAt), 'dd MMMM yyyy')],
    ['Update frequency', metadata.updateFrequency],
    ['Access level', metadata.accessLevel],
    ['Resolution', metadata.resolution],
    ['Geographic extent', metadata.geographicExtent],
    ['Coordinate reference system', metadata.coordinateReferenceSystem],
    ['Licence', metadata.licence],
    ['Available file formats', metadata.format?.join(', ')]
  ]
  const detailsUrl = metadata.id && pluginConfig.findGeoDataUrl
    ? new URL(`/dataset/${encodeURIComponent(metadata.id)}`, pluginConfig.findGeoDataUrl).href
    : null

  return (
    <div className='app-map__dataset-info'>
      {metadata.abstract && <DatasetAbstract key={datasetId} text={metadata.abstract} />}
      <dl className='govuk-summary-list govuk-!-margin-bottom-6'>
        {rows.map(([label, value]) => (
          <div className='govuk-summary-list__row' key={label}>
            <dt className='govuk-summary-list__key'>{label}</dt>
            <dd className='govuk-summary-list__value'>{value || '-'}</dd>
          </div>
        ))}
      </dl>
      {detailsUrl && (
        <p className='govuk-body govuk-!-margin-bottom-0'>
          <a className='govuk-link' href={detailsUrl} target='_blank' rel='noreferrer noopener'>
            View full dataset (opens in new tab)
          </a>
        </p>
      )}
    </div>
  )
}
