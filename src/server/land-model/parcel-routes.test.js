import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { AWS_VERSION_ID, TEST_AUTH, createTestServer, generatedAt, jsonObject, manifest, partialContent, serveObjects, styleConfig } from '../common/test-helpers/s3.js'
import { landModel } from './index.js'

const logger = vi.hoisted(() => ({ debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }))
vi.mock('../common/helpers/logging/logger.js', () => ({ createLogger: () => logger }))

const PREFIX = 'land-model/parcels'
const LAYER = '/api/land-model/parcels/layer'
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

test('requires authentication and serves only the parcel features', async () => {
  expect((await server.inject(LAYER)).statusCode).toBe(401)
  expect((await server.inject(`${ASSETS}/data.fgb`)).statusCode).toBe(401)
  for (const filename of ['data.tif', 'manifest.json', 'style.json']) {
    const response = await get(`${ASSETS}/${filename}`, { headers: { range: 'bytes=0-3' } })
    expect(response.statusCode).toBe(404)
    expect(response.result).toEqual({ error: 'Parcels file not found' })
  }
  expect(send).not.toHaveBeenCalled()
})

test('returns the parcels release with only its FlatGeobuf URL', async () => {
  serveObjects(send, PREFIX, {
    'manifest.json': jsonObject(manifest({ 'style.json': 'style-version', 'data.fgb': AWS_VERSION_ID, 'data.tif': null }), 'manifest-version'),
    'style.json': jsonObject(styleConfig, 'style-version')
  })

  const response = await get(LAYER)

  expect(response.result).toEqual({
    manifestVersion: 'manifest-version',
    generatedAt,
    styleConfig,
    assets: { fgb: `${ASSETS}/data.fgb?v=3%2FL4kqtJlcpXroDTDmJ%2BrmSpXd3dIbrHY` }
  })
  expect(send.mock.calls.map(([command]) => command.input.Key)).toEqual([`${PREFIX}/manifest.json`, `${PREFIX}/style.json`])
})

test('reads parcel assets from the parcels prefix at the pinned version', async () => {
  send.mockResolvedValue(partialContent())

  const response = await get(`${ASSETS}/data.fgb?v=fgb-version`, { headers: { range: 'bytes=0-3' } })

  expect(response.statusCode).toBe(206)
  expect(send.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand)
  expect(send.mock.calls[0][0].input).toStrictEqual({ Bucket: 'datasets', Key: `${PREFIX}/data.fgb`, VersionId: 'fgb-version', Range: 'bytes=0-3' })
})
