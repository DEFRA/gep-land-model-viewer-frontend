import { SummaryList } from '../../panels/shared/SummaryList.jsx'
import { formatUpdatedYear } from './format.js'

/**
 * @param {import('../model.js').Source | undefined} source
 * @param {Date} [refreshed]
 */
export function getProvenanceRows (source, refreshed) {
  const date = refreshed ?? source?.updated
  const updated = date ? [{ label: 'Last updated', value: formatUpdatedYear(date) }] : []
  const sourceRows = source?.name?.trim() ? [{ label: 'Data source', value: source.name }] : []

  return [...updated, ...sourceRows]
}

/** @param {{ source?: import('../model.js').Source, separator?: boolean }} props */
export function Provenance ({ source, separator = false }) {
  const rows = getProvenanceRows(source)
  if (!rows.length) {
    return null
  }

  return <SummaryList className={`app-map__summary-list${separator ? ' app-map__summary-list--separated' : ''}`} rows={rows} />
}
