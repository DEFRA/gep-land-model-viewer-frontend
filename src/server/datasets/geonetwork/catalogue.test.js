import { getDatasetMetadata, queryDatasets } from './catalogue.js'
import { hit } from './test-helpers/peaty-soil-depth.js'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('undici', () => ({ request }))

beforeEach(() => {
  request.mockResolvedValue({ statusCode: 200, body: { json: async () => ({ hits: { total: { value: 1 }, hits: [hit] } }) } })
})

test('searches catalogue text by prefix with a result limit and returns summaries', async () => {
  const result = await queryDatasets('pea')
  const query = JSON.parse(request.mock.calls[0][1].body)

  expect(query).toMatchObject({
    size: 500,
    query: { bool: { filter: [{ term: { isTemplate: 'n' } }], must: { multi_match: { query: 'pea', type: 'bool_prefix', operator: 'and' } } } }
  })
  expect(result).toEqual({ results: [{ id: hit._id, title: hit._source.resourceTitleObject.default, inspireTheme: 'Soil' }], total: 1 })
  expect(request.mock.calls[0][0]).toMatch(/\/search\/records\/_search$/)
})

test('browses the catalogue without requiring a query', async () => {
  await queryDatasets('')
  expect(JSON.parse(request.mock.calls[0][1].body).query).toEqual({ bool: { filter: [{ term: { isTemplate: 'n' } }], must: { match_all: {} } } })
})

test('looks up metadata records only, excluding templates', async () => {
  await getDatasetMetadata(hit._id)
  expect(JSON.parse(request.mock.calls[0][1].body).query).toEqual({ bool: { filter: [{ term: { isTemplate: 'n' } }, { ids: { values: [hit._id] } }] } })
})

test('maps the Elasticsearch record into dataset metadata', async () => {
  const result = await getDatasetMetadata(hit._id)

  expect(result).toEqual({
    id: hit._id,
    title: 'England Peat Map Peaty Soil Depth',
    inspireTheme: 'Soil',
    abstract: hit._source.resourceAbstractObject.default,
    owner: 'Natural England',
    accessLevel: 'Open data',
    updateFrequency: 'As needed',
    categories: ['Environment'],
    updatedAt: '2025-05-09',
    licence: 'Open Government Licence',
    format: [
      'Cloud Optimized GeoTIFF',
      'Proprietary format | ESRI File based Geodatabase (GDB)',
      'Open format | Shapefile (SHP)',
      'Open format | JavaScript Object Notation (GeoJSON)',
      'Open format | Keyhole Markup Language (KML)',
      'Open format | Comma Separated Values file (CSV)',
      'Open format | MS Excel (XLSX)',
      'Open format | GeoPackage (GPKG)'
    ],
    coordinateReferenceSystem: 'http://www.opengis.net/def/crs/EPSG/0/27700',
    places: ['England'],
    resolution: ['10 m'],
    creationDate: '2025-05-06'
  })
})

test('returns null when the catalogue record is missing', async () => {
  request.mockResolvedValue({ statusCode: 200, body: { json: async () => ({ hits: { hits: [] } }) } })
  expect(await getDatasetMetadata(hit._id)).toBeNull()
})

test('reports catalogue errors and consumes the error response', async () => {
  const dump = vi.fn()
  request.mockResolvedValue({ statusCode: 503, body: { dump } })

  await expect(queryDatasets('')).rejects.toThrow('GeoNetwork search returned 503')
  expect(dump).toHaveBeenCalledOnce()
})
