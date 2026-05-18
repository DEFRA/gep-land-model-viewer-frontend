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

  test('VTS style URLs point to local style JSON files', () => {
    const vtsStyles = mapStyles.filter(s => !s.type)
    expect(vtsStyles.length).toBeGreaterThan(0)
    for (const style of vtsStyles) {
      expect(style.url).toMatch(/^\/map\/style\/.*\.json$/)
    }
  })

  test('NGD style URLs point to NGD API proxy', () => {
    const ngdStyles = mapStyles.filter(s => s.type === 'ogc-vt')
    expect(ngdStyles.length).toBeGreaterThanOrEqual(4)
    for (const style of ngdStyles) {
      expect(style.url).toMatch(/^\/os\/ngd\/collections\/ngd-base\/styles\//)
    }
  })

  test('raster style URLs point to raster proxy with tile template', () => {
    const rasterStyles = mapStyles.filter(s => s.type === 'raster')
    expect(rasterStyles.length).toBeGreaterThan(0)
    for (const style of rasterStyles) {
      expect(style.url).toMatch(/^\/os\/raster\/.*\/{z}\/{x}\/{y}\.png$/)
    }
  })

  test('each style uses the OS attribution', () => {
    for (const style of mapStyles) {
      expect(style.attribution).toBe(OS_ATTRIBUTION)
    }
  })
})
