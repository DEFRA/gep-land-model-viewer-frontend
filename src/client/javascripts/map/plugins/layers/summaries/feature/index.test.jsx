// @vitest-environment jsdom
import { describe, test, expect } from 'vitest'
import { featureHitOptions } from './index.jsx'
import { toFeatureRecord } from './data.js'

const PROPERTIES = {
  osid: 'parcel-1',
  land_cover_dominant_value: 'Improved grass',
  land_cover_intersections_json: '[{"mapped_value":"Improved grass","intersection_area":100,"intersection_pct":100}]'
}
const SOURCES = { land_cover: { name: 'UKCEH Land Cover Map', date: '2026-10-21T10:47:51.297Z' } }
const LAYER = { id: 'features', source: { type: 'fgb', url: '/data.fgb', dataSources: SOURCES } }

describe('featureHitOptions', () => {
  test('labels, builds and renders a parcel land summary with the release\'s sources', () => {
    const details = featureHitOptions.toDetails([PROPERTIES], LAYER)

    expect(details).toEqual(toFeatureRecord(PROPERTIES, SOURCES))
    expect(details.landCover.source.name).toBe('UKCEH Land Cover Map')
    expect(featureHitOptions.label()).toBe('OS feature')
    expect(featureHitOptions.render(details).props.record).toBe(details)
  })
})
