import { datasets } from './datasets.js'

describe('#datasets', () => {
  test('exports an array of datasets from EA catalog', () => {
    expect(Array.isArray(datasets)).toBe(true)
    expect(datasets.length).toBe(7)
  })

  test('each dataset has required properties', () => {
    for (const dataset of datasets) {
      expect(dataset).toHaveProperty('id')
      expect(dataset).toHaveProperty('label')
      expect(dataset).toHaveProperty('source')
      expect(dataset.source).toHaveProperty('type', 'wms')
      expect(dataset.source).toHaveProperty('url')
      expect(dataset.source.url).toMatch(/^https:\/\/environment\.data\.gov\.uk\/spatialdata\//)
      expect(dataset.source).toHaveProperty('attribution')
      expect(dataset.source.attribution).toMatch(/Environment Agency/)
    }
  })
})
