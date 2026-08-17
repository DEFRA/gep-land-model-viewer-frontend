import { vi, describe, test, expect, afterEach } from 'vitest'
import { isCoarsePointer } from './pointer.js'

describe('#isCoarsePointer', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('is false without touch support', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    vi.stubGlobal('navigator', { maxTouchPoints: 0 })

    expect(isCoarsePointer()).toBe(false)
  })

  test('is true when the pointer media query matches', () => {
    vi.stubGlobal('matchMedia', (query) => ({ matches: query === '(pointer: coarse)' }))
    vi.stubGlobal('navigator', { maxTouchPoints: 0 })

    expect(isCoarsePointer()).toBe(true)
  })

  test('is true when the device reports touch points', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    vi.stubGlobal('navigator', { maxTouchPoints: 5 })

    expect(isCoarsePointer()).toBe(true)
  })
})
