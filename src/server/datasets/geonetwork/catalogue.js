import { request } from 'undici'
import { config } from '../../../config/config.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { fields, recordSourceIncludes, searchFields, searchSourceIncludes } from './fields.js'

export const MAX_RESULTS = 500

const RECORDS_ONLY = { term: { isTemplate: 'n' } }

/**
 * Catalogue metadata, separate from the dataset's S3 files and style.
 *
 * @typedef {object} DatasetMetadata
 * @property {string} id
 * @property {string} title
 * @property {string} inspireTheme
 * @property {string} abstract
 * @property {string | null} owner
 * @property {string | null} accessLevel
 * @property {string | null} updateFrequency
 * @property {string[]} categories
 * @property {string | null} updatedAt
 * @property {string | null} licence
 * @property {string[]} format
 * @property {string | null} coordinateReferenceSystem
 * @property {string[]} places
 * @property {string[]} resolution
 * @property {string | null} creationDate
 */

/** @typedef {Pick<DatasetMetadata, 'id' | 'title' | 'inspireTheme'>} DatasetSummary */
/** @typedef {{ _id: string, _source?: Record<string, any> }} SearchHit */
/** @typedef {{ hits: { hits: SearchHit[], total: { value: number } } }} SearchResponse */

/**
 * @param {Record<string, unknown>} body
 * @returns {Promise<SearchResponse>}
 */
async function searchRecords (body) {
  const url = `${config.get('geonetwork.apiUrl').replace(/\/$/, '')}/search/records/_search`
  const response = await request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000)
  })

  if (response.statusCode !== statusCodes.ok) {
    await response.body.dump()
    throw new Error(`GeoNetwork search returned ${response.statusCode}`)
  }

  return /** @type {Promise<SearchResponse>} */ (response.body.json())
}

/**
 * @param {SearchHit} hit
 * @param {(field: import('./fields.js').Field) => boolean} include
 * @returns {Partial<DatasetMetadata>}
 */
function mapHit (hit, include) {
  const src = hit._source ?? {}
  const result = { id: hit._id }

  for (const [name, field] of Object.entries(fields)) {
    if (!include(field)) {
      continue
    }
    result[name] = field.hitAccessor(src)
  }

  return result
}

/** @param {SearchHit} hit */
function mapSearchHit (hit) {
  return /** @type {DatasetSummary} */ (mapHit(hit, (field) => Boolean(field.inSearchResult)))
}

/** @param {SearchHit} hit */
function mapRecordHit (hit) {
  return /** @type {DatasetMetadata} */ (mapHit(hit, () => true))
}

/**
 * Searches titles and abstracts, or lists datasets by title for an empty query.
 *
 * Pagination is not currently supported, returns up to MAX_RESULTS records
 * with the total number of matches.
 *
 * @param {string} q Query string
 * @returns {Promise<{ results: DatasetSummary[], total: number }>}
 */
export async function queryDatasets (q) {
  const result = await searchRecords({
    size: MAX_RESULTS,
    track_total_hits: true,
    _source: searchSourceIncludes,
    query: {
      bool: {
        filter: [RECORDS_ONLY],
        must: q
          ? {
              multi_match: {
                query: q,
                type: 'bool_prefix',
                operator: 'and',
                fields: searchFields
              }
            }
          : { match_all: {} }
      }
    },
    sort: q ? [{ _score: 'desc' }] : [{ [fields.title.sort.field]: 'asc' }]
  })

  return {
    results: result.hits.hits.map(mapSearchHit),
    total: result.hits.total.value
  }
}

/**
 * Looks up a catalogue record by UUID, returning null when it is not found.
 *
 * @param {string} id
 * @returns {Promise<DatasetMetadata | null>}
 */
export async function getDatasetMetadata (id) {
  const result = await searchRecords({
    size: 1,
    _source: recordSourceIncludes,
    query: { bool: { filter: [RECORDS_ONLY, { ids: { values: [id] } }] } }
  })
  const hit = result.hits.hits[0]
  if (!hit) {
    return null
  }

  return mapRecordHit(hit)
}
