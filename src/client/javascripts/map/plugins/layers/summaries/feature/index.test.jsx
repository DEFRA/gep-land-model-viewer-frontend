// @vitest-environment jsdom
import { describe, test, expect } from 'vitest'
import { featureHitOptions } from './index.jsx'
import { toFeatureRecord } from './data.js'

const PROPERTIES = {
  osid: 'parcel-1',
  toid: 'osgb1',
  land_cover_dom_code: 'C021',
  land_cover_dom_name: 'Improved grass',
  land_cover_proportions: '{"Improved grass":100.0}'
}

describe('featureHitOptions', () => {
  test('labels, builds and renders a parcel land summary', () => {
    const details = featureHitOptions.toDetails([PROPERTIES])

    expect(details).toEqual(toFeatureRecord(PROPERTIES))
    expect(featureHitOptions.label()).toBe('OS feature')
    expect(featureHitOptions.render(details).props.record).toBe(details)
  })
})
