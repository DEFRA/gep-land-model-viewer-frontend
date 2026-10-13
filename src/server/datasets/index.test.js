import Hapi from '@hapi/hapi'
import { PassThrough, Readable } from 'node:stream'
import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { datasets } from './index.js'

const { getDatasetMetadata, queryDatasets } = vi.hoisted(() => ({
  getDatasetMetadata: vi.fn(), queryDatasets: vi.fn()
}))
vi.mock('./geonetwork/catalogue.js', () => ({ getDatasetMetadata, queryDatasets }))

const logger = vi.hoisted(() => ({ debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }))
vi.mock('../common/helpers/logging/logger.js', () => ({ createLogger: () => logger }))

const LOCAL = '11111111-1111-4111-8111-111111111111'
const LAYER = `/api/datasets/${LOCAL}/layer`
const ASSETS = `${LAYER}/assets`
const AWS_VERSION_ID = '3/L4kqtJlcpXroDTDmJ+rmSpXd3dIbrHY'
const generatedAt = '2026-10-08T14:52:12.304Z'
const styleConfig = { themes: [{ type: 'uniform', band: 1, classes: [] }] }
let server
let send

function get (url, options = {}) {
  return server.inject({ url, auth: { strategy: 'test', credentials: { id: 'user' } }, ...options })
}

function s3Error (status) {
  return Object.assign(new Error(`S3 error ${status}`), { $metadata: { httpStatusCode: status } })
}

/**
 * @param {unknown} value Serialised unless it is already text
 * @param {string} [versionId] S3 response version ID
 */
function jsonObject (value, versionId) {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return { Body: { transformToString: async () => text }, VersionId: versionId }
}

function manifest (files) {
  return { generatedAt, files }
}

function partialContent (body = '0123', contentRange = `bytes 0-${body.length - 1}/10`) {
  return {
    Body: Readable.from([Buffer.from(body)], { objectMode: false }),
    ContentLength: body.length,
    ContentRange: contentRange,
    $metadata: { httpStatusCode: 206 }
  }
}

/**
 * Responds to S3 commands by filename. Errors are thrown and missing files give an S3 404.
 *
 * @param {Record<string, object>} objects
 */
function serveObjects (objects) {
  send.mockImplementation(async command => {
    const object = objects[command.input.Key.slice(`${LOCAL}/`.length)] ?? s3Error(404)
    if (object instanceof Error) {
      throw object
    }

    return object
  })
}

beforeEach(async () => {
  send = vi.spyOn(S3Client.prototype, 'send')
  getDatasetMetadata.mockImplementation(async id => ({ id, title: 'Peaty soil depth', owner: 'Natural England' }))
  server = Hapi.server()
  server.auth.scheme('test', () => ({
    authenticate (_request, h) {
      return h.response({ error: 'Unauthorized' }).code(401).takeover()
    }
  }))
  server.auth.strategy('test', 'test')
  server.auth.default('test')
  await server.register(datasets)
})

afterEach(async () => {
  await server.stop()
  vi.restoreAllMocks()
})

test('search accepts only q and reads no S3 files', async () => {
  const result = { results: [{ id: LOCAL, title: 'Peat' }], total: 1 }
  queryDatasets.mockResolvedValue(result)

  const response = await get('/api/datasets?q=%20peat%20')

  expect(response.result).toEqual(result)
  expect(queryDatasets).toHaveBeenCalledWith('peat')
  expect(send).not.toHaveBeenCalled()
  await get('/api/datasets')
  expect(queryDatasets).toHaveBeenLastCalledWith('')
  expect((await get('/api/datasets?page=2')).statusCode).toBe(400)
  expect((await get(`/api/datasets?q=${'a'.repeat(201)}`)).statusCode).toBe(400)
})

test('requires authentication and rejects paths, queries or ranges the proxy does not support', async () => {
  expect((await server.inject(LAYER)).statusCode).toBe(401)
  expect((await server.inject(`${ASSETS}/data.tif`)).statusCode).toBe(401)
  expect((await get('/api/datasets/not-a-uuid')).statusCode).toBe(404)
  expect((await get('/api/datasets/not-a-uuid/layer')).statusCode).toBe(404)
  expect((await get('/api/datasets/not-a-uuid/layer/assets/data.tif', { headers: { range: 'bytes=0-3' } })).statusCode).toBe(404)
  expect((await get(`/api/datasets/${LOCAL}/rendering`)).statusCode).toBe(404)
  for (const filename of ['secret.json', 'manifest.json', 'style.json']) {
    expect((await get(`${ASSETS}/${filename}`, { headers: { range: 'bytes=0-3' } })).statusCode).toBe(404)
  }
  for (const query of ['v=', 'v=a&v=b', `v=${'a'.repeat(1025)}`, `v=${encodeURIComponent('é'.repeat(513))}`, 'version=a', 'v=a&x=1']) {
    expect((await get(`${ASSETS}/data.tif?${query}`, { headers: { range: 'bytes=0-3' } })).statusCode).toBe(404)
  }
  expect((await get(`${ASSETS}/data.tif`, { headers: { range: 'bytes=0-10,20-30' } })).statusCode).toBe(400)
  expect(send).not.toHaveBeenCalled()
})

test('no longer serves assets from the old route', async () => {
  const response = await get(`/api/datasets/${LOCAL}/assets/data.tif`, { headers: { range: 'bytes=0-3' } })

  expect(response.statusCode).toBe(404)
  expect(send).not.toHaveBeenCalled()
})

test.each([
  undefined,
  '',
  'bytes=0-',
  'bytes=-4',
  'bytes=0-3,8-9',
  'items=0-3',
  'bytes=4-3',
  'bytes=0-NaN',
  'bytes=0-9007199254740992'
])('rejects GET range %j before contacting S3', async range => {
  for (const filename of ['data.tif', 'data.fgb']) {
    const response = await get(`${ASSETS}/${filename}`, {
      headers: range === undefined ? {} : { range }
    })

    expect(response.statusCode).toBe(400)
  }
  expect(send).not.toHaveBeenCalled()
})

test('returns GeoNetwork metadata without reading S3', async () => {
  const response = await get(`/api/datasets/${LOCAL}`)

  expect(response.statusCode).toBe(200)
  expect(response.result).toEqual({ id: LOCAL, title: 'Peaty soil depth', owner: 'Natural England' })
  expect(getDatasetMetadata).toHaveBeenCalledWith(LOCAL)
  expect(send).not.toHaveBeenCalled()
})

test('returns 404 when GeoNetwork has no record', async () => {
  getDatasetMetadata.mockResolvedValue(null)

  const response = await get(`/api/datasets/${LOCAL}`)

  expect(response.statusCode).toBe(404)
  expect(response.result).toEqual({ error: 'Dataset not found' })
})

test('does not treat a failed GeoNetwork lookup as a missing dataset', async () => {
  getDatasetMetadata.mockRejectedValue(new Error('GeoNetwork unavailable'))

  const response = await get(`/api/datasets/${LOCAL}`)

  expect(response.statusCode).toBe(502)
  expect(response.result).toEqual({ error: 'Dataset service unavailable' })
})

test('returns the manifest version and reads the style at the version it lists', async () => {
  serveObjects({
    'manifest.json': jsonObject(manifest({ 'style.json': 'style-version', 'data.tif': 'tif-version', 'data.fgb': 'fgb-version' }), AWS_VERSION_ID),
    'style.json': jsonObject(styleConfig, 'style-version')
  })

  const response = await get(LAYER)

  expect(response.statusCode).toBe(200)
  expect(response.result).toEqual({
    manifestVersion: AWS_VERSION_ID,
    generatedAt,
    styleConfig,
    assets: {
      cog: `${ASSETS}/data.tif?v=tif-version`,
      fgb: `${ASSETS}/data.fgb?v=fgb-version`
    }
  })
  expect(send).toHaveBeenCalledTimes(2)
  const [[manifestRead], [styleRead]] = send.mock.calls
  expect(manifestRead).toBeInstanceOf(GetObjectCommand)
  expect(manifestRead.input).toStrictEqual({ Bucket: 'datasets', Key: `${LOCAL}/manifest.json` })
  expect(styleRead).toBeInstanceOf(GetObjectCommand)
  expect(styleRead.input).toStrictEqual({ Bucket: 'datasets', Key: `${LOCAL}/style.json`, VersionId: 'style-version' })
})

test('returns a null manifest version and latest-file URLs for an unversioned release', async () => {
  serveObjects({
    'manifest.json': jsonObject(manifest({ 'style.json': null, 'data.tif': null, 'data.fgb': null })),
    'style.json': jsonObject(styleConfig)
  })

  const response = await get(LAYER)

  expect(response.result).toEqual({
    manifestVersion: null,
    generatedAt,
    styleConfig,
    assets: { cog: `${ASSETS}/data.tif`, fgb: `${ASSETS}/data.fgb` }
  })
  expect(send.mock.calls[1][0].input).toStrictEqual({ Bucket: 'datasets', Key: `${LOCAL}/style.json` })
})

test.each([
  { files: { 'data.tif': null }, assets: { cog: `${ASSETS}/data.tif` } },
  { files: { 'data.fgb': 'fgb-version' }, assets: { fgb: `${ASSETS}/data.fgb?v=fgb-version` } },
  { files: { 'secret.json': null }, assets: {} }
])('links only the data files the manifest lists: $files', async ({ files, assets }) => {
  serveObjects({
    'manifest.json': jsonObject({ ...manifest({ 'style.json': null, ...files }), publisher: 'pipeline' }),
    'style.json': jsonObject(styleConfig)
  })

  const response = await get(LAYER)

  expect(response.statusCode).toBe(200)
  expect(response.result.assets).toEqual(assets)
})

test('passes a version ID containing / and + from the manifest to S3 unchanged', async () => {
  serveObjects({
    'manifest.json': jsonObject(manifest({ 'style.json': AWS_VERSION_ID, 'data.tif': AWS_VERSION_ID })),
    'style.json': jsonObject(styleConfig),
    'data.tif': partialContent()
  })

  const { result: { assets } } = await get(LAYER)
  expect(assets.cog).toBe(`${ASSETS}/data.tif?v=3%2FL4kqtJlcpXroDTDmJ%2BrmSpXd3dIbrHY`)
  const file = await get(assets.cog, { headers: { range: 'bytes=0-3' } })

  expect(file.statusCode).toBe(206)
  expect(file.payload).toBe('0123')
  expect(send.mock.calls.map(([command]) => command.input.VersionId)).toEqual([undefined, AWS_VERSION_ID, AWS_VERSION_ID])
})

test('keeps reading the versions a layer loaded after a newer release is published', async () => {
  serveObjects({
    'manifest.json': jsonObject(manifest({ 'style.json': null, 'data.fgb': 'old-fgb' })),
    'style.json': jsonObject(styleConfig)
  })
  const { result: { assets } } = await get(LAYER)
  send.mockClear()
  serveObjects({
    'manifest.json': jsonObject(manifest({ 'style.json': null, 'data.fgb': 'new-fgb' })),
    'data.fgb': partialContent()
  })

  const file = await get(assets.fgb, { headers: { range: 'bytes=0-3' } })

  expect(file.statusCode).toBe(206)
  expect(send).toHaveBeenCalledOnce()
  expect(send.mock.calls[0][0].input).toStrictEqual({ Bucket: 'datasets', Key: `${LOCAL}/data.fgb`, VersionId: 'old-fgb', Range: 'bytes=0-3' })
})

test('returns 404 when the dataset has no manifest', async () => {
  serveObjects({ 'style.json': jsonObject(styleConfig) })

  const response = await get(LAYER)

  expect(response.statusCode).toBe(404)
  expect(response.result).toEqual({ error: 'Dataset layer not found' })
  expect(send).toHaveBeenCalledOnce()
  expect(logger.error).not.toHaveBeenCalled()
})

test.each([
  { release: 'manifest that is not JSON', manifestBody: '{ not json' },
  { release: 'manifest without generatedAt', manifestBody: { files: { 'style.json': null } } },
  { release: 'manifest without files', manifestBody: { generatedAt } },
  { release: 'manifest with a numeric version', manifestBody: manifest({ 'style.json': null, 'data.tif': 1 }) },
  { release: 'manifest with an empty version', manifestBody: manifest({ 'style.json': null, 'data.tif': '' }) },
  { release: 'manifest with a version over 1,024 bytes', manifestBody: manifest({ 'style.json': null, 'data.tif': 'é'.repeat(513) }) },
  { release: 'manifest without a style entry', manifestBody: manifest({ 'data.tif': null }) },
  { release: 'style that is not JSON', style: '{ not json' },
  { release: 'style that is not an object', style: 'null' },
  { release: 'style that is an array', style: [] }
])('returns 500 and logs an error for a $release', async ({ manifestBody = manifest({ 'style.json': null }), style = styleConfig }) => {
  serveObjects({ 'manifest.json': jsonObject(manifestBody), 'style.json': jsonObject(style) })

  const response = await get(LAYER)

  expect(response.statusCode).toBe(500)
  expect(response.result).toEqual({ error: 'Dataset layer is invalid' })
  expect(logger.error).toHaveBeenCalledOnce()
  expect(logger.error.mock.calls[0][0].err.name).toBe('BrokenReleaseError')
})

test('returns 500 when S3 cannot find the pinned style version', async () => {
  const error = s3Error(404)
  serveObjects({ 'manifest.json': jsonObject(manifest({ 'style.json': 'pinned-version' })), 'style.json': error })

  const response = await get(LAYER)

  expect(response.statusCode).toBe(500)
  expect(send.mock.calls[1][0].input).toStrictEqual({ Bucket: 'datasets', Key: `${LOCAL}/style.json`, VersionId: 'pinned-version' })
  expect(logger.error).toHaveBeenCalledOnce()
  expect(logger.error.mock.calls[0][0].err).toMatchObject({ name: 'BrokenReleaseError', cause: error })
})

test.each([
  { failure: 'manifest request times out', objects: { 'manifest.json': Object.assign(new Error('Timed out'), { name: 'TimeoutError' }) } },
  { failure: 'manifest request is rejected', objects: { 'manifest.json': s3Error(400) } },
  { failure: 'pinned style request is rejected', objects: { 'manifest.json': jsonObject(manifest({ 'style.json': 'style-version' })), 'style.json': s3Error(400) } },
  { failure: 'style read fails', objects: { 'manifest.json': jsonObject(manifest({ 'style.json': 'style-version' })), 'style.json': s3Error(503) } }
])('returns 502 when the $failure', async ({ objects }) => {
  serveObjects(objects)

  const response = await get(LAYER)

  expect(response.statusCode).toBe(502)
  expect(response.result).toEqual({ error: 'Dataset service unavailable' })
})

test('streams the requested range without conditional or internal S3 headers', async () => {
  send.mockResolvedValue({
    Body: Object.assign(Readable.from([Buffer.from('0123')], { objectMode: false }), {
      statusCode: 206,
      headers: {
        etag: '"current"',
        'last-modified': 'Wed, 01 Jan 2025 00:00:00 GMT',
        'x-amz-request-id': 's3-request-id'
      }
    }),
    ContentType: 'image/tiff',
    ContentLength: 4,
    ContentRange: 'bytes 0-3/10',
    ETag: '"current"',
    $metadata: { httpStatusCode: 206 }
  })

  const file = await get(`${ASSETS}/data.tif`, { headers: { range: 'bytes=0-3', 'if-range': '"old"', 'if-none-match': '"current"' } })
  expect(file.statusCode).toBe(206)
  expect(file.payload).toBe('0123')
  expect(file.headers).toMatchObject({ 'content-type': 'image/tiff', 'content-range': 'bytes 0-3/10', 'content-length': '4', 'accept-ranges': 'bytes' })
  expect(file.headers.etag).toBeUndefined()
  expect(file.headers['last-modified']).toBeUndefined()
  expect(file.headers['x-amz-request-id']).toBeUndefined()
  expect(send).toHaveBeenCalledOnce()
  const [command] = send.mock.calls[0]
  expect(command).toBeInstanceOf(GetObjectCommand)
  expect(command.input).toStrictEqual({ Bucket: 'datasets', Key: `${LOCAL}/data.tif`, Range: 'bytes=0-3' })
})

test.each([
  { method: 'GET', Command: GetObjectCommand, status: 206 },
  { method: 'HEAD', Command: HeadObjectCommand, status: 200 }
])('$method sends v to S3 as VersionId and leaves it out without v', async ({ method, Command, status }) => {
  send.mockImplementation(async () => {
    if (method === 'HEAD') {
      return { ContentLength: 4, $metadata: { httpStatusCode: 200 } }
    }

    return partialContent()
  })
  const options = { method, headers: { range: 'bytes=0-3' } }

  expect((await get(`${ASSETS}/data.fgb?v=fgb-version`, options)).statusCode).toBe(status)
  expect((await get(`${ASSETS}/data.fgb`, options)).statusCode).toBe(status)

  const [[versioned], [latest]] = send.mock.calls
  expect(versioned).toBeInstanceOf(Command)
  expect(versioned.input).toStrictEqual({ Bucket: 'datasets', Key: `${LOCAL}/data.fgb`, VersionId: 'fgb-version', Range: 'bytes=0-3' })
  expect(latest).toBeInstanceOf(Command)
  expect(latest.input).toStrictEqual({ Bucket: 'datasets', Key: `${LOCAL}/data.fgb`, Range: 'bytes=0-3' })
})

test('accepts a v of 1,024 bytes', async () => {
  send.mockResolvedValue(partialContent())
  const version = 'a'.repeat(1024)

  const response = await get(`${ASSETS}/data.tif?v=${version}`, { headers: { range: 'bytes=0-3' } })

  expect(response.statusCode).toBe(206)
  expect(send.mock.calls[0][0].input.VersionId).toBe(version)
})

test.each(['GET', 'HEAD'])('%s returns 404 for a missing pinned version without reading the latest object', async method => {
  send.mockRejectedValue(s3Error(404))

  const response = await get(`${ASSETS}/data.tif?v=unknown-version`, { method, headers: { range: 'bytes=0-3' } })

  expect(response.statusCode).toBe(404)
  expect(response.payload).toBe('')
  expect(send).toHaveBeenCalledOnce()
  expect(send.mock.calls[0][0].input.VersionId).toBe('unknown-version')
})

test.each(['GET', 'HEAD'])('%s returns 502 for S3 request errors with or without a version', async method => {
  const error = Object.assign(s3Error(400), { name: 'AuthorizationHeaderMalformed' })
  send.mockRejectedValue(error)

  for (const query of ['', '?v=tif-version']) {
    const response = await get(`${ASSETS}/data.tif${query}`, { method, headers: { range: 'bytes=0-3' } })

    expect(response.statusCode).toBe(502)
    expect(response.result).toEqual(method === 'HEAD' ? null : { error: 'Dataset service unavailable' })
  }

  expect(send).toHaveBeenCalledTimes(2)
  expect(send.mock.calls.map(([command]) => command.input.VersionId)).toEqual([undefined, 'tif-version'])
  expect(logger.error).toHaveBeenCalledTimes(2)
  expect(logger.error.mock.calls[0][0].err).toBe(error)
})

test('cancels S3 when the browser disconnects before response headers arrive', async () => {
  /** @type {import('node:http').ServerResponse} */
  let response
  server.ext('onRequest', (request, h) => {
    response = request.raw.res
    return h.continue
  })

  const started = Promise.withResolvers()
  send.mockImplementation(async (_command, { abortSignal }) => {
    started.resolve(abortSignal)
    return new Promise((_resolve, reject) => {
      abortSignal.addEventListener('abort', () => reject(abortSignal.reason), { once: true })
    })
  })

  const loading = get(`${ASSETS}/data.tif`, { headers: { range: 'bytes=0-3' } })
  await started.promise
  const { abortSignal } = send.mock.calls[0][1]
  expect(abortSignal.aborted).toBe(false)

  response.destroy()
  await loading

  expect(abortSignal.aborted).toBe(true)
})

test('cancels S3 and closes the body when the browser disconnects during streaming', async () => {
  const streaming = Promise.withResolvers()
  /** @type {import('node:http').ServerResponse} */
  let response
  server.ext('onRequest', (request, h) => {
    response = request.raw.res
    response.once('pipe', streaming.resolve)
    return h.continue
  })

  const body = new PassThrough()
  send.mockResolvedValue({
    Body: body,
    ContentLength: 4,
    ContentRange: 'bytes 0-3/10',
    $metadata: { httpStatusCode: 206 }
  })

  const loading = get(`${ASSETS}/data.tif?v=tif-version`, { headers: { range: 'bytes=0-3' } })
  await streaming.promise
  body.write(Buffer.from('01'))
  const { abortSignal } = send.mock.calls[0][1]
  expect(abortSignal.aborted).toBe(false)
  const disconnected = expect(loading).rejects.toMatchObject({ output: { statusCode: 499 } })

  response.destroy()
  await disconnected

  expect(abortSignal.aborted).toBe(true)
  expect(body.destroyed).toBe(true)
})

test.each([
  { range: 'bytes=4-7', contentRange: 'bytes 4-7/10', body: '4567' },
  { range: 'bytes=4-4', contentRange: 'bytes 4-4/10', body: '4' },
  { range: 'bytes=8-100', contentRange: 'bytes 8-9/10', body: '89' },
  { range: 'bytes=0-99999999999', contentRange: 'bytes 0-9/10', body: '0123456789' }
])('streams $range, allowing large requests and clipping at EOF', async ({ range, contentRange, body }) => {
  send.mockResolvedValue(partialContent(body, contentRange))

  const response = await get(`${ASSETS}/data.fgb`, { headers: { range } })

  expect(response.statusCode).toBe(206)
  expect(response.payload).toBe(body)
  expect(response.headers['content-range']).toBe(contentRange)
  expect(response.headers['content-length']).toBe(String(body.length))
  expect(send.mock.calls[0][0].input.Range).toBe(range)
})

test('aborts a full response without reading or forwarding its body', async () => {
  const read = vi.fn()
  const body = new Readable({ read })
  send.mockResolvedValue({
    Body: body,
    ContentLength: 10,
    $metadata: { httpStatusCode: 200 }
  })

  const response = await get(`${ASSETS}/data.tif`, { headers: { range: 'bytes=0-3' } })

  expect(response.statusCode).toBe(502)
  expect(response.result).toEqual({ error: 'Dataset service unavailable' })
  expect(read).not.toHaveBeenCalled()
  expect(body.destroyed).toBe(true)
  expect(send.mock.calls[0][1].abortSignal.aborted).toBe(true)
  expect(send).toHaveBeenCalledOnce()
})

test.each([
  { failure: 'access failures', error: s3Error(403) },
  { failure: 'a missing bucket', error: Object.assign(s3Error(404), { name: 'NoSuchBucket' }) }
])('does not hide $failure as missing files', async ({ error }) => {
  send.mockRejectedValue(error)

  expect((await get(LAYER)).statusCode).toBe(502)
  expect((await get(`${ASSETS}/data.tif`, { headers: { range: 'bytes=0-3' } })).statusCode).toBe(502)
  expect((await get(`${ASSETS}/data.tif?v=tif-version`, { headers: { range: 'bytes=0-3' } })).statusCode).toBe(502)
})

test.each([404, 416])('passes S3 status %i through without its error body', async status => {
  send.mockRejectedValueOnce(s3Error(status))

  const response = await get(`${ASSETS}/data.tif`, { headers: { range: 'bytes=100-200' } })

  expect(response.statusCode).toBe(status)
  expect(response.payload).toBe('')
})

test('preserves the size from an S3 416 without another request', async () => {
  send.mockRejectedValueOnce(Object.assign(s3Error(416), { $response: { headers: { 'content-range': 'bytes */10' } } }))

  const response = await get(`${ASSETS}/data.fgb?v=fgb-version`, { headers: { range: 'bytes=100-200' } })

  expect(response.statusCode).toBe(416)
  expect(response.headers['content-range']).toBe('bytes */10')
  expect(response.payload).toBe('')
  expect(send).toHaveBeenCalledOnce()
})

test.each([undefined, 'bytes=0-3'])('HEAD with range %j returns metadata without fetching the body', async range => {
  const size = range ? 4 : 10
  send.mockResolvedValue({ ContentLength: size, $metadata: { httpStatusCode: 200 } })

  const response = await get(`${ASSETS}/data.tif`, {
    method: 'HEAD',
    headers: range === undefined ? {} : { range }
  })

  expect(response.statusCode).toBe(200)
  expect(response.payload).toBe('')
  expect(response.headers['content-length']).toBe(String(size))
  expect(send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand)
  expect(send.mock.calls[0][0].input.Range).toBe(range)
})
