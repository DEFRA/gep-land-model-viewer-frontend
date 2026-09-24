import Hapi from '@hapi/hapi'
import { PassThrough, Readable } from 'node:stream'
import { S3Client, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { datasets } from './index.js'

const { getDatasetMetadata, queryDatasets } = vi.hoisted(() => ({
  getDatasetMetadata: vi.fn(), queryDatasets: vi.fn()
}))
vi.mock('./geonetwork/catalogue.js', () => ({ getDatasetMetadata, queryDatasets }))

const LOCAL = '11111111-1111-4111-8111-111111111111'
const styleConfig = { themes: [{ type: 'uniform', band: 1, classes: [] }] }
let server
let send

function get (url, options = {}) {
  return server.inject({ url, auth: { strategy: 'test', credentials: { id: 'user' } }, ...options })
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

test('requires authentication and rejects paths or ranges the proxy does not support', async () => {
  expect((await server.inject(`/api/datasets/${LOCAL}/assets/data.tif`)).statusCode).toBe(401)
  expect((await get('/api/datasets/not-a-uuid')).statusCode).toBe(404)
  expect((await get(`/api/datasets/${LOCAL}/rendering`)).statusCode).toBe(404)
  expect((await get(`/api/datasets/${LOCAL}/assets/secret.json`)).statusCode).toBe(404)
  expect((await get(`/api/datasets/${LOCAL}/assets/data.tif`, { headers: { range: 'bytes=0-10,20-30' } })).statusCode).toBe(400)
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
    const response = await get(`/api/datasets/${LOCAL}/assets/${filename}`, {
      headers: range === undefined ? {} : { range }
    })

    expect(response.statusCode).toBe(400)
  }
  expect(send).not.toHaveBeenCalled()
})

test('returns 404 when GeoNetwork has no record, even if S3 has files', async () => {
  getDatasetMetadata.mockResolvedValue(null)
  send.mockImplementation(async command => {
    if (command instanceof GetObjectCommand) {
      return { Body: { transformToString: async () => JSON.stringify(styleConfig) } }
    }
    return { Contents: [{ Key: `${LOCAL}/data.tif` }] }
  })

  const response = await get(`/api/datasets/${LOCAL}`)

  expect(response.statusCode).toBe(404)
  expect(response.result).toEqual({ error: 'Dataset not found' })
})

test('does not treat a failed GeoNetwork lookup as a missing dataset', async () => {
  getDatasetMetadata.mockRejectedValue(new Error('GeoNetwork unavailable'))
  send.mockImplementation(async command => {
    if (command instanceof GetObjectCommand) {
      return { Body: { transformToString: async () => JSON.stringify(styleConfig) } }
    }
    return { Contents: [{ Key: `${LOCAL}/data.tif` }] }
  })

  const response = await get(`/api/datasets/${LOCAL}`)

  expect(response.statusCode).toBe(502)
  expect(response.result).toEqual({ error: 'Dataset service unavailable' })
})

test('discovers S3 files while GeoNetwork is loading', async () => {
  const metadata = Promise.withResolvers()
  const s3Started = Promise.withResolvers()
  getDatasetMetadata.mockReturnValueOnce(metadata.promise)
  send.mockImplementation(async command => {
    s3Started.resolve()
    if (command instanceof ListObjectsV2Command) {
      return { Contents: [{ Key: `${LOCAL}/data.tif` }, { Key: `${LOCAL}/style.json` }] }
    }
    return { Body: { transformToString: async () => JSON.stringify(styleConfig) } }
  })

  const loading = get(`/api/datasets/${LOCAL}`)
  await s3Started.promise
  expect(getDatasetMetadata).toHaveBeenCalledWith(LOCAL)
  metadata.resolve({ id: LOCAL, title: 'Peaty soil depth', owner: 'Natural England' })
  const detail = await loading
  expect(detail.result).toEqual({
    id: LOCAL,
    title: 'Peaty soil depth',
    owner: 'Natural England',
    display: { styleConfig, assets: { cog: `/api/datasets/${LOCAL}/assets/data.tif` } }
  })
  const listing = send.mock.calls.find(([command]) => command instanceof ListObjectsV2Command)[0]
  expect(listing.input).toEqual({ Bucket: 'datasets', Prefix: `${LOCAL}/` })
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

  const file = await get(`/api/datasets/${LOCAL}/assets/data.tif`, { headers: { range: 'bytes=0-3', 'if-range': '"old"', 'if-none-match': '"current"' } })
  expect(file.statusCode).toBe(206)
  expect(file.payload).toBe('0123')
  expect(file.headers).toMatchObject({ 'content-type': 'image/tiff', 'content-range': 'bytes 0-3/10', 'content-length': '4', 'accept-ranges': 'bytes' })
  expect(file.headers.etag).toBeUndefined()
  expect(file.headers['last-modified']).toBeUndefined()
  expect(file.headers['x-amz-request-id']).toBeUndefined()
  expect(send).toHaveBeenCalledOnce()
  const [command] = send.mock.calls[0]
  expect(command).toBeInstanceOf(GetObjectCommand)
  expect(command.input).toEqual({ Bucket: 'datasets', Key: `${LOCAL}/data.tif`, Range: 'bytes=0-3' })
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

  const loading = get(`/api/datasets/${LOCAL}/assets/data.tif`, { headers: { range: 'bytes=0-3' } })
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

  const loading = get(`/api/datasets/${LOCAL}/assets/data.tif`, { headers: { range: 'bytes=0-3' } })
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
  send.mockResolvedValue({
    Body: Readable.from([Buffer.from(body)], { objectMode: false }),
    ContentLength: body.length,
    ContentRange: contentRange,
    $metadata: { httpStatusCode: 206 }
  })

  const response = await get(`/api/datasets/${LOCAL}/assets/data.fgb`, { headers: { range } })

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

  const response = await get(`/api/datasets/${LOCAL}/assets/data.tif`, { headers: { range: 'bytes=0-3' } })

  expect(response.statusCode).toBe(502)
  expect(response.result).toEqual({ error: 'Dataset service unavailable' })
  expect(read).not.toHaveBeenCalled()
  expect(body.destroyed).toBe(true)
  expect(send.mock.calls[0][1].abortSignal.aborted).toBe(true)
  expect(send).toHaveBeenCalledOnce()
})

test('does not hide S3 access failures as missing optional files', async () => {
  send.mockRejectedValue(Object.assign(new Error('Access denied'), { $metadata: { httpStatusCode: 403 } }))

  expect((await get(`/api/datasets/${LOCAL}`)).statusCode).toBe(502)
  expect((await get(`/api/datasets/${LOCAL}/assets/data.tif`, { headers: { range: 'bytes=0-3' } })).statusCode).toBe(502)
})

test.each([
  { case: 'missing', style: undefined },
  { case: 'empty', style: '' },
  { case: 'invalid', style: '{ not json' }
])('a $case style does not prevent valid metadata from loading', async ({ style }) => {
  send.mockImplementation(async command => {
    if (command instanceof GetObjectCommand) {
      if (style === undefined) {
        throw Object.assign(new Error('Not found'), { $metadata: { httpStatusCode: 404 } })
      }
      return { Body: { transformToString: async () => style } }
    }
    return { Contents: [{ Key: `${LOCAL}/data.tif` }, { Key: `${LOCAL}/data.fgb` }] }
  })

  const metadata = await get(`/api/datasets/${LOCAL}`)
  expect(metadata.statusCode).toBe(200)
  expect(metadata.result.owner).toBe('Natural England')
  expect(metadata.result.display).toEqual({
    styleConfig: null,
    assets: {
      cog: `/api/datasets/${LOCAL}/assets/data.tif`,
      fgb: `/api/datasets/${LOCAL}/assets/data.fgb`
    }
  })
})

test.each([404, 416])('passes S3 status %s through without its error body', async status => {
  send.mockRejectedValueOnce(Object.assign(new Error('S3 error'), { $metadata: { httpStatusCode: status } }))

  const response = await get(`/api/datasets/${LOCAL}/assets/data.tif`, { headers: { range: 'bytes=100-200' } })

  expect(response.statusCode).toBe(status)
  expect(response.payload).toBe('')
})

test('preserves the size from an S3 416 without another request', async () => {
  send.mockRejectedValueOnce(Object.assign(new Error('Invalid range'), {
    $metadata: { httpStatusCode: 416 },
    $response: { headers: { 'content-range': 'bytes */10' } }
  }))

  const response = await get(`/api/datasets/${LOCAL}/assets/data.fgb`, { headers: { range: 'bytes=100-200' } })

  expect(response.statusCode).toBe(416)
  expect(response.headers['content-range']).toBe('bytes */10')
  expect(response.payload).toBe('')
  expect(send).toHaveBeenCalledOnce()
})

test.each([undefined, 'bytes=0-3'])('HEAD with range %j returns metadata without fetching the body', async range => {
  const size = range ? 4 : 10
  send.mockResolvedValue({ ContentLength: size, $metadata: { httpStatusCode: 200 } })

  const response = await get(`/api/datasets/${LOCAL}/assets/data.tif`, {
    method: 'HEAD',
    headers: range === undefined ? {} : { range }
  })

  expect(response.statusCode).toBe(200)
  expect(response.payload).toBe('')
  expect(response.headers['content-length']).toBe(String(size))
  expect(send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand)
  expect(send.mock.calls[0][0].input.Range).toBe(range)
})
