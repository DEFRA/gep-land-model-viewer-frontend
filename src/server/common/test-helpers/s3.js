import Hapi from '@hapi/hapi'
import { Readable } from 'node:stream'

export const TEST_AUTH = { strategy: 'test', credentials: { id: 'user' } }
export const AWS_VERSION_ID = '3/L4kqtJlcpXroDTDmJ+rmSpXd3dIbrHY'
export const generatedAt = '2026-10-08T14:52:12.304Z'
export const styleConfig = { themes: [{ type: 'uniform', band: 1, classes: [] }] }

export function createTestServer () {
  const server = Hapi.server()
  server.auth.scheme('test', () => ({
    authenticate (_request, h) {
      return h.response({ error: 'Unauthorized' }).code(401).takeover()
    }
  }))
  server.auth.strategy('test', 'test')
  server.auth.default('test')
  return server
}

/** @param {number} status */
export function s3Error (status) {
  return Object.assign(new Error(`S3 error ${status}`), { $metadata: { httpStatusCode: status } })
}

/**
 * @param {unknown} value Serialised unless it is already text
 * @param {string} [versionId] S3 response version ID
 */
export function jsonObject (value, versionId) {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return { Body: { transformToString: async () => text }, VersionId: versionId }
}

/** @param {Record<string, unknown>} files */
export function manifest (files) {
  return { generatedAt, files }
}

export function partialContent (body = '0123', contentRange = `bytes 0-${body.length - 1}/10`) {
  return {
    Body: Readable.from([Buffer.from(body)], { objectMode: false }),
    ContentLength: body.length,
    ContentRange: contentRange,
    $metadata: { httpStatusCode: 206 }
  }
}

/**
 * Responds to S3 commands by filename below the prefix. Errors are thrown and missing files give an S3 404.
 *
 * @param {import('vitest').MockInstance} send
 * @param {string} prefix
 * @param {Record<string, object>} objects
 */
export function serveObjects (send, prefix, objects) {
  send.mockImplementation(async command => {
    const object = objects[command.input.Key.slice(`${prefix}/`.length)] ?? s3Error(404)
    if (object instanceof Error) {
      throw object
    }

    return object
  })
}
