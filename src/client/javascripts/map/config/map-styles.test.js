import { mapStyles, OS_ATTRIBUTION, APGB_ATTRIBUTION, OS_NGD_STYLE_IDS, OS_NGD_TILESET_URL } from './map-styles.js'

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

  test('WMS style URLs point to WMS proxy', () => {
    const wmsStyles = mapStyles.filter(s => s.type === 'wms')
    for (const style of wmsStyles) {
      expect(style.url).toMatch(/^\/wms\//)
      expect(style.params).toHaveProperty('LAYERS')
    }
  })

  test('OS styles use the OS attribution', () => {
    const osStyles = mapStyles.filter(s => s.type === 'ogc-vt')
    for (const style of osStyles) {
      expect(style.attribution).toBe(OS_ATTRIBUTION)
    }
  })

  test('aerial style uses the APGB attribution', () => {
    const aerial = mapStyles.find(s => s.id === 'apgb-aerial')
    expect(aerial.attribution).toBe(APGB_ATTRIBUTION)
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
