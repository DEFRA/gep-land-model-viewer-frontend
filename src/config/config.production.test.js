import { describe, test, expect, vi, beforeAll, afterAll } from 'vitest'

describe('config in production mode', () => {
  let originalNodeEnv

  beforeAll(() => {
    originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    vi.resetModules()
  })

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv
    vi.resetModules()
  })

  test('uses production defaults', async () => {
    const { config } = await import('./config.js')

    expect(config.get('log.format')).toBe('ecs')
    expect(config.get('session.cache.engine')).toBe('redis')
    expect(config.get('isSecureContextEnabled')).toBe(true)
    expect(config.get('log.redact')).toContain('req.headers.authorization')
  })
})
