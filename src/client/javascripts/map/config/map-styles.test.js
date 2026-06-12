import { mapStyles, OS_ATTRIBUTION, OS_NGD_STYLE_IDS, OS_NGD_TILESET_URL } from './map-styles.js'

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

  test('NGD style URLs point to NGD API proxy', () => {
    const ngdStyles = mapStyles.filter(s => s.type === 'ogc-vt')
    expect(ngdStyles.length).toBeGreaterThanOrEqual(4)
    for (const style of ngdStyles) {
      expect(style.url).toMatch(/^\/os\/ngd\/collections\/ngd-base\/styles\//)
    }
  })

  test('raster style URLs point to raster proxy with tile template', () => {
    const rasterStyles = mapStyles.filter(s => s.type === 'raster')
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

describe('#OS_NGD_STYLE_IDS', () => {
  test('lists every NGD style and excludes the raster style', () => {
    expect(OS_NGD_STYLE_IDS).toEqual(['os-outdoor-ngd', 'os-road-ngd', 'os-light-ngd', 'os-bw-ngd'])
  })
})

describe('#OS_NGD_TILESET_URL', () => {
  test('points at the NGD tileset under the proxy', () => {
    expect(OS_NGD_TILESET_URL).toBe('/os/ngd/collections/ngd-base/tiles/27700')
  })
})
