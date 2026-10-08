import { useEffect, useState } from 'react'
import { DatasetAbstract } from './DatasetAbstract.jsx'
import { SummaryList } from '../shared/SummaryList.jsx'
import { formatDatasetDate, formatResolution } from '../shared/format.js'
import { loadDatasetMetadata } from '../../datasets/api.js'

export function DatasetInfoPanel ({ datasetId, pluginConfig }) {
  const [dataset, setDataset] = useState(/** @type {{ status: string, metadata?: Record<string, any> }} */ ({ status: 'loading' }))

  useEffect(() => {
    const controller = new AbortController()
    setDataset({ status: 'loading' })
    loadDatasetMetadata(datasetId, controller.signal)
      .then(loadedMetadata => ({ status: 'ready', metadata: loadedMetadata }))
      .catch(() => ({ status: 'error' }))
      .then(loaded => {
        if (!controller.signal.aborted) {
          setDataset(loaded)
        }
      })

    return () => controller.abort()
  }, [datasetId])

  const metadata = dataset.metadata ?? {}
  const rows = [
    ['Source', metadata.owner],
    ['Categories', metadata.categories?.join(', ')],
    ['Creation date', formatDatasetDate(metadata.creationDate)],
    ['Last updated', formatDatasetDate(metadata.updatedAt)],
    ['Update frequency', metadata.updateFrequency],
    ['Access level', metadata.accessLevel],
    ['Resolution', formatResolution(metadata.resolution)],
    ['Geographic extent', metadata.places?.join(', ')],
    ['Coordinate reference system', metadata.coordinateReferenceSystem],
    ['Licence', metadata.licence],
    ['Available file formats', metadata.format?.join(', ')]
  ]
  const detailsUrl = pluginConfig.findGeoDataUrl
    ? new URL(`/dataset/${encodeURIComponent(datasetId)}`, pluginConfig.findGeoDataUrl).href
    : null

  return (
    <div className='app-map__dataset-info'>
      {dataset.status !== 'ready' && (
        <p className='govuk-body govuk-!-margin-bottom-6'>
          <output>{dataset.status === 'error' ? 'Dataset information could not be loaded.' : 'Loading dataset information…'}</output>
        </p>
      )}
      {metadata.abstract && <DatasetAbstract key={datasetId} text={metadata.abstract} />}
      {dataset.status === 'ready' && (
        <SummaryList
          className='govuk-!-margin-bottom-6'
          rows={rows.map(([label, value]) => ({ label, value: value || '-' }))}
        />
      )}
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
