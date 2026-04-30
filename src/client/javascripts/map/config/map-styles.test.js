import { mapStyles, OS_ATTRIBUTION } from './map-styles.js'

describe('#mapStyles', () => {
  test('exports an array of map styles', () => {
    expect(Array.isArray(mapStyles)).toBe(true)
    expect(mapStyles.length).toBeGreaterThan(0)
  })

  test('each style has required properties', () => {
    for (const style of mapStyles) {
      expect(style).toHaveProperty('id')
      expect(style).toHaveProperty('label')
      expect(style).toHaveProperty('url')
      expect(style).toHaveProperty('thumbnail')
      expect(style).toHaveProperty('attribution')
      expect(style).toHaveProperty('mapColorScheme')
      expect(style).toHaveProperty('appColorScheme')
    }
  })

  test('style URLs point to local VTS JSON files', () => {
    for (const style of mapStyles) {
      expect(style.url).toMatch(/^\/map\/style\/.*\.json$/)
    }
  })

  test('each style uses the OS attribution', () => {
    for (const style of mapStyles) {
      expect(style.attribution).toBe(OS_ATTRIBUTION)
    }
  })
})
