import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { AWS_VERSION_ID, TEST_AUTH, createTestServer, generatedAt, jsonObject, manifest, partialContent, serveObjects, styleConfig } from '../common/test-helpers/s3.js'
import { landModel } from './index.js'

const logger = vi.hoisted(() => ({ debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }))
vi.mock('../common/helpers/logging/logger-options.js', () => ({ loggerOptions: { enabled: false } }))
vi.mock('../common/helpers/logging/logger.js', async (importOriginal) => ({ ...await importOriginal(), createLogger: () => logger }))

const PREFIX = 'land-model/grid'
const LAYER = '/api/land-model/grid/layer'
const ASSETS = `${LAYER}/assets`
let server
let send

function get (url, options = {}) {
  return server.inject({ url, auth: TEST_AUTH, ...options })
}

beforeEach(async () => {
  send = vi.spyOn(S3Client.prototype, 'send')
  server = createTestServer()
  await server.register(landModel)
})

afterEach(async () => {
  await server.stop()
  vi.restoreAllMocks()
})

test('requires authentication and serves only the grid COG and FGBs', async () => {
  expect((await server.inject(LAYER)).statusCode).toBe(401)
  expect((await server.inject(`${ASSETS}/10.tif`)).statusCode).toBe(401)
  for (const filename of ['data.fgb', 'bands.json', 'manifest.json', 'style.json']) {
    const response = await get(`${ASSETS}/${filename}`, { headers: { range: 'bytes=0-3' } })
    expect(response.statusCode).toBe(404)
    expect(response.result).toEqual({ error: 'Grid file not found' })
  }
  expect(send).not.toHaveBeenCalled()
})

test('returns the grid release with its band descriptions, data sources and the URLs of the files it lists', async () => {
  const bands = { land_cover_dominant_value: { band: 1, classes: [] } }
  const dataSources = { land_cover: { name: 'UKCEH Land Cover Map', date: '2026-10-21T11:16:39.058Z' } }
  serveObjects(send, PREFIX, {
    'manifest.json': jsonObject({
      ...manifest({
        'style.json': 'style-version',
        'bands.json': 'bands-version',
        '10.tif': AWS_VERSION_ID,
        '100.fgb': '100-fgb-version',
        '1000.fgb': '1000-fgb-version'
      }),
      dataSources
    }, 'manifest-version'),
    'style.json': jsonObject(styleConfig, 'style-version'),
    'bands.json': jsonObject(bands, 'bands-version')
  })

  const response = await get(LAYER)

  expect(response.result).toEqual({
    manifestVersion: 'manifest-version',
    generatedAt,
    styleConfig,
    dataSources,
    bands,
    assets: {
      cog: `${ASSETS}/10.tif?v=3%2FL4kqtJlcpXroDTDmJ%2BrmSpXd3dIbrHY`,
      fgbs: {
        100: `${ASSETS}/100.fgb?v=100-fgb-version`,
        1000: `${ASSETS}/1000.fgb?v=1000-fgb-version`
      }
    }
  })
  expect(send.mock.calls.map(([command]) => [command.input.Key, command.input.VersionId])).toEqual([
    [`${PREFIX}/manifest.json`, undefined],
    [`${PREFIX}/style.json`, 'style-version'],
    [`${PREFIX}/bands.json`, 'bands-version']
  ])
})

test('keeps data sources with other fields or no date', async () => {
  const dataSources = { land_cover: { name: 'UKCEH Land Cover Map', date: null, theme: 'LAND_COVER' } }
  serveObjects(send, PREFIX, {
    'manifest.json': jsonObject({ ...manifest({ 'style.json': null, 'bands.json': null, '10.tif': null }), dataSources }),
    'style.json': jsonObject(styleConfig),
    'bands.json': jsonObject({})
  })

  const response = await get(LAYER)

  expect(response.statusCode).toBe(200)
  expect(response.result.dataSources).toEqual(dataSources)
})

test('reads the grid FGBs from the grid prefix at the pinned version', async () => {
  send.mockResolvedValue(partialContent())

  const response = await get(`${ASSETS}/100.fgb?v=fgb-version`, { headers: { range: 'bytes=0-3' } })

  expect(response.statusCode).toBe(206)
  expect(send.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand)
  expect(send.mock.calls[0][0].input).toStrictEqual({ Bucket: 'datasets', Key: `${PREFIX}/100.fgb`, VersionId: 'fgb-version', Range: 'bytes=0-3' })
})
