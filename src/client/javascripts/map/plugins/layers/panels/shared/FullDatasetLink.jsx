export function FullDatasetLink ({ datasetId, findGeoDataUrl }) {
  if (!datasetId || !findGeoDataUrl) {
    return null
  }

  const href = new URL(`/dataset/${encodeURIComponent(datasetId)}`, findGeoDataUrl).href

  return (
    <p className='govuk-body govuk-!-margin-bottom-0 app-map__dataset-link'>
      <a className='govuk-link' href={href} target='_blank' rel='noreferrer noopener'>
        View full dataset (opens in new tab)
      </a>
    </p>
  )
}
